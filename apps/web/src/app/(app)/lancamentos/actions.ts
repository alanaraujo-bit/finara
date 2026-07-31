"use server";

import { and, db, eq, financialAccounts, sql, transactions } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paraDataLocal } from "@/lib/datas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { exigirSessao } from "@/lib/session";

const esquema = z.object({
  tipo: z.enum(["expense", "income"]),
  valor: z.string().min(1, "Informe o valor."),
  descricao: z.string().trim().min(1, "Descreva o lançamento.").max(120),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  categoriaId: z.string().optional(),
  contaId: z.string().optional(),
  titularidade: z.enum(["conjunto", "meu"]),
  observacao: z.string().trim().max(500).optional(),
});

export type EstadoLancamento = { erro?: string; ok?: boolean };

/**
 * Cria um lancamento manual.
 *
 * O saldo da conta e' materializado (`currentBalance`), entao ele e' ajustado
 * na MESMA transacao do insert. Fazer em duas idas ao banco abriria uma janela
 * em que o extrato mostra o gasto e o saldo ainda nao — num app de dinheiro,
 * essa incoerencia destroi a confianca do usuario no numero.
 */
export async function criarLancamento(
  _anterior: EstadoLancamento,
  form: FormData,
): Promise<EstadoLancamento> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    tipo: form.get("tipo"),
    valor: form.get("valor"),
    descricao: form.get("descricao"),
    data: form.get("data"),
    categoriaId: form.get("categoriaId") || undefined,
    contaId: form.get("contaId") || undefined,
    titularidade: form.get("titularidade"),
    observacao: form.get("observacao") || undefined,
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { tipo, valor, descricao, data, categoriaId, contaId, titularidade, observacao } =
    parsed.data;

  const centavos = parseMoney(valor);

  if (centavos <= 0) {
    return { erro: "O valor precisa ser maior que zero." };
  }

  // A conta precisa ser deste workspace; id vindo do formulario nao e' confiavel.
  let contaValida: string | null = null;
  if (contaId) {
    const [conta] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, contaId),
          eq(financialAccounts.workspaceId, workspace.workspaceId),
        ),
      )
      .limit(1);

    if (!conta) return { erro: "Conta não encontrada." };
    contaValida = conta.id;
  }

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values({
      id: newId(),
      workspaceId: workspace.workspaceId,
      type: tipo,
      status: "cleared",
      // Sempre positivo — o sinal mora em `type`. Ver o schema.
      amount: centavos,
      description: descricao,
      notes: observacao ?? null,
      date: data,
      accountId: contaValida,
      categoryId: categoriaId || null,
      ownerId: titularidade === "conjunto" ? null : usuario.id,
    });

    if (contaValida) {
      const delta = tipo === "income" ? centavos : -centavos;
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
          updatedAt: new Date(),
        })
        .where(eq(financialAccounts.id, contaValida));
    }
  });

  revalidatePath("/lancamentos");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Apaga um lancamento, devolvendo o valor ao saldo da conta.
 * Sem o estorno, apagar um gasto deixaria o saldo permanentemente errado.
 */
export async function excluirLancamento(id: string): Promise<EstadoLancamento> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [alvo] = await tx
      .select({
        id: transactions.id,
        tipo: transactions.type,
        valor: transactions.amount,
        contaId: transactions.accountId,
      })
      .from(transactions)
      .where(
        and(eq(transactions.id, id), eq(transactions.workspaceId, workspace.workspaceId)),
      )
      .limit(1);

    if (!alvo) return;

    await tx.delete(transactions).where(eq(transactions.id, alvo.id));

    if (alvo.contaId) {
      // Estorno: o inverso do que foi aplicado na criacao.
      const delta = alvo.tipo === "income" ? -alvo.valor : alvo.valor;
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
          updatedAt: new Date(),
        })
        .where(eq(financialAccounts.id, alvo.contaId));
    }
  });

  revalidatePath("/lancamentos");
  revalidatePath("/");
  return { ok: true };
}
