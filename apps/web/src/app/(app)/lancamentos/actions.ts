"use server";

import { and, creditCards, db, eq, financialAccounts, sql, transactions } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mesmoDiaNoMes } from "@/lib/datas";
import { cicloDaCompra, cicloDaReferencia, referenciaMaisMeses } from "@/lib/faturas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { garantirFatura } from "@/lib/queries/cartoes";
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
  // Parcelamento de compra no cartao. 1 = a vista.
  parcelas: z.coerce.number().int().min(1).max(36, "No máximo 36 parcelas.").default(1),
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
    parcelas: form.get("parcelas") || "1",
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { tipo, valor, descricao, data, categoriaId, origem, titularidade, observacao, parcelas } =
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

  if (parcelas > 1 && !cartao) {
    return { erro: "Parcelamento só existe em compra no cartão de crédito." };
  }

  // Divisao em centavos: a sobra vai para a PRIMEIRA parcela, como fazem as
  // administradoras. Sem isso a soma das parcelas nao fecha com o preco.
  const base = Math.floor(centavos / parcelas);
  const sobra = centavos - base * parcelas;
  const grupoId = parcelas > 1 ? newId() : null;

  // Ciclo da PRIMEIRA parcela: as demais andam sobre o mes de referencia
  // dele, nunca sao re-inferidas de uma data de calendario (ver o comentario
  // de `referenciaMaisMeses` — inferir de novo colide fevereiro com janeiro
  // sempre que o fechamento cai no dia 28).
  const cicloBase = cartao ? cicloDaCompra(data, cartao.fechamento, cartao.vencimento) : null;

  await db.transaction(async (tx) => {
    const executor = tx as unknown as typeof db;

    for (let i = 0; i < parcelas; i++) {
      // Data do lancamento em si (calendario/extrato). Independente da
      // fatura: uma parcela pode ter dia de calendario 28 de fevereiro e
      // ainda assim pertencer ao SEU proprio ciclo, distinto do da vizinha.
      const dataDaParcela = i === 0 ? data : mesmoDiaNoMes(data, i);

      const invoiceId =
        cartao && cicloBase
          ? await garantirFatura({
              workspaceId: workspace.workspaceId,
              cardId: cartao.id,
              ciclo: cicloDaReferencia(
                referenciaMaisMeses(cicloBase.referencia, i),
                cartao.fechamento,
                cartao.vencimento,
              ),
              executor,
            })
          : null;

      await tx.insert(transactions).values({
        id: newId(),
        workspaceId: workspace.workspaceId,
        type: tipo,
        status: "cleared",
        // Sempre positivo — o sinal mora em `type`. Ver o schema.
        amount: i === 0 ? base + sobra : base,
        description: descricao,
        notes: observacao ?? null,
        date: dataDaParcela,
        // Competencia fica na data da COMPRA: e' o mes em que o gasto pesa,
        // mesmo que a parcela caia um ano depois.
        competenceDate: parcelas > 1 ? data : null,
        accountId: contaValida,
        cardId: cartao?.id ?? null,
        invoiceId,
        categoryId: categoriaId || null,
        ownerId: titularidade === "conjunto" ? null : usuario.id,
        installmentNumber: parcelas > 1 ? i + 1 : null,
        installmentTotal: parcelas > 1 ? parcelas : null,
        installmentGroupId: grupoId,
      });
    }

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
