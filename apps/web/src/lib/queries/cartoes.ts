import {
  and,
  asc,
  cardInvoices,
  creditCards,
  db,
  desc,
  eq,
  sql,
  transactions,
} from "@finara/db";
import { cicloDaCompra } from "@/lib/faturas";
import { newId } from "@/lib/id";

export type CartaoComFatura = {
  id: string;
  nome: string;
  bandeira: string | null;
  finalCartao: string | null;
  limite: number;
  cor: string;
  ownerId: string | null;
  diaFechamento: number;
  diaVencimento: number;
  /** Fatura aberta mais recente. Null se o cartao ainda nao teve compra. */
  faturaId: string | null;
  faturaReferencia: string | null;
  faturaVencimento: string | null;
  faturaTotal: number;
  faturaStatus: string | null;
};

export async function listarCartoes(workspaceId: string): Promise<CartaoComFatura[]> {
  const cartoes = await db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.workspaceId, workspaceId), eq(creditCards.isArchived, false)))
    .orderBy(asc(creditCards.sortOrder), asc(creditCards.name));

  if (cartoes.length === 0) return [];

  // Total real da fatura vem da soma dos lancamentos, nao do campo
  // materializado: assim um lancamento editado ou apagado nao deixa a
  // fatura mentindo.
  const faturas = await db
    .select({
      id: cardInvoices.id,
      cardId: cardInvoices.cardId,
      referencia: cardInvoices.referenceMonth,
      vencimento: cardInvoices.dueDate,
      status: cardInvoices.status,
      total: sql<number>`coalesce((
        select sum(${transactions.amount})
        from ${transactions}
        where ${transactions.invoiceId} = ${cardInvoices.id}
          and ${transactions.status} <> 'canceled'
      ), 0)`,
    })
    .from(cardInvoices)
    .where(eq(cardInvoices.workspaceId, workspaceId))
    .orderBy(desc(cardInvoices.referenceMonth));

  return cartoes.map((c) => {
    const fatura = faturas.find((f) => f.cardId === c.id) ?? null;
    return {
      id: c.id,
      nome: c.name,
      bandeira: c.brand,
      finalCartao: c.lastFourDigits,
      limite: c.creditLimit,
      cor: c.color,
      ownerId: c.ownerId,
      diaFechamento: c.closingDay,
      diaVencimento: c.dueDay,
      faturaId: fatura?.id ?? null,
      faturaReferencia: fatura?.referencia ?? null,
      faturaVencimento: fatura?.vencimento ?? null,
      faturaTotal: Number(fatura?.total ?? 0),
      faturaStatus: fatura?.status ?? null,
    };
  });
}

/**
 * Garante que exista a fatura do ciclo ao qual a compra pertence, e devolve
 * o id dela. Criada sob demanda: nao ha' motivo pra existir fatura vazia.
 *
 * Chamada de dentro de uma transacao do banco quando o lancamento e' criado.
 */
export async function garantirFaturaDaCompra(params: {
  workspaceId: string;
  cardId: string;
  dataCompra: string;
  diaFechamento: number;
  diaVencimento: number;
  // Executor opcional para participar de uma transacao ja' aberta.
  executor?: typeof db;
}): Promise<string> {
  const { workspaceId, cardId, dataCompra, diaFechamento, diaVencimento } = params;
  const exec = params.executor ?? db;

  const ciclo = cicloDaCompra(dataCompra, diaFechamento, diaVencimento);

  const [existente] = await exec
    .select({ id: cardInvoices.id })
    .from(cardInvoices)
    .where(
      and(eq(cardInvoices.cardId, cardId), eq(cardInvoices.referenceMonth, ciclo.referencia)),
    )
    .limit(1);

  if (existente) return existente.id;

  const id = newId();
  await exec.insert(cardInvoices).values({
    id,
    workspaceId,
    cardId,
    referenceMonth: ciclo.referencia,
    closingDate: ciclo.fechamento,
    dueDate: ciclo.vencimento,
  });

  return id;
}

/** Lancamentos de uma fatura, para a tela de detalhe. */
export async function listarLancamentosDaFatura(faturaId: string, workspaceId: string) {
  return db
    .select({
      id: transactions.id,
      descricao: transactions.description,
      valor: transactions.amount,
      data: transactions.date,
      parcela: transactions.installmentNumber,
      parcelasTotal: transactions.installmentTotal,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.invoiceId, faturaId),
        eq(transactions.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(transactions.date));
}
