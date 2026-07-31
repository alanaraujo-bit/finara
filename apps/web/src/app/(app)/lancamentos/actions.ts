"use server";

import { and, creditCards, db, eq, financialAccounts, sql, transactions } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { garantirFaturaDaCompra } from "@/lib/queries/cartoes";
import { exigirSessao } from "@/lib/session";

const esquema = z.object({
  tipo: z.enum(["expense", "income"]),
  valor: z.string().min(1, "Informe o valor."),
  descricao: z.string().trim().min(1, "Descreva o lançamento.").max(120),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  categoriaId: z.string().optional(),
  // "conta:<id>" ou "cartao:<id>". Um campo so' no formulario evita o estado
  // invalido de ter conta E cartao preenchidos ao mesmo tempo.
  origem: z.string().optional(),
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
    origem: form.get("origem") || undefined,
    titularidade: form.get("titularidade"),
    observacao: form.get("observacao") || undefined,
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { tipo, valor, descricao, data, categoriaId, origem, titularidade, observacao } =
    parsed.data;

  const centavos = parseMoney(valor);

  if (centavos <= 0) {
    return { erro: "O valor precisa ser maior que zero." };
  }

  const [genero, alvoId] = (origem ?? "").split(":");

  let contaValida: string | null = null;
  let cartao: { id: string; fechamento: number; vencimento: number } | null = null;

  // Id vindo do formulario nao e' confiavel: sempre confirmar que pertence
  // a este workspace antes de usar.
  if (genero === "conta" && alvoId) {
    const [c] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, alvoId),
          eq(financialAccounts.workspaceId, workspace.workspaceId),
        ),
      )
      .limit(1);

    if (!c) return { erro: "Conta não encontrada." };
    contaValida = c.id;
  } else if (genero === "cartao" && alvoId) {
    const [c] = await db
      .select({
        id: creditCards.id,
        fechamento: creditCards.closingDay,
        vencimento: creditCards.dueDay,
      })
      .from(creditCards)
      .where(
        and(eq(creditCards.id, alvoId), eq(creditCards.workspaceId, workspace.workspaceId)),
      )
      .limit(1);

    if (!c) return { erro: "Cartão não encontrado." };
    if (tipo === "income") {
      return { erro: "Cartão de crédito só recebe despesas. Escolha uma conta para entradas." };
    }
    cartao = c;
  }

  await db.transaction(async (tx) => {
    // Compra no cartao entra na fatura do ciclo correspondente — e NAO mexe
    // no saldo da conta. O dinheiro so' sai quando a fatura e' paga.
    const invoiceId = cartao
      ? await garantirFaturaDaCompra({
          workspaceId: workspace.workspaceId,
          cardId: cartao.id,
          dataCompra: data,
          diaFechamento: cartao.fechamento,
          diaVencimento: cartao.vencimento,
          executor: tx as unknown as typeof db,
        })
      : null;

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
      cardId: cartao?.id ?? null,
      invoiceId,
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

  revalidatePath("/cartoes");

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
