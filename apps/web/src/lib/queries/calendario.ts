import {
  and,
  cardInvoices,
  categories,
  creditCards,
  db,
  debtInstallments,
  debts,
  desc,
  eq,
  gte,
  inArray,
  lte,
  ne,
  sql,
  subscriptions,
  transactions,
} from "@finara/db";
import { limitesDoMes } from "@/lib/datas";

export type DiaDoCalendario = {
  data: string;
  gasto: number;
  entrada: number;
  lancamentos: number;
  /** Compromissos que vencem nesse dia (assinatura, fatura, parcela). */
  compromissos: { nome: string; valor: number; tipo: "assinatura" | "fatura" | "divida" }[];
};

/**
 * Um mes de calendario: o que ja' foi gasto por dia, e o que ainda vence.
 *
 * Passado e futuro no mesmo grid de proposito — e' o que permite olhar o mes
 * e ver que o dia 5 ja' tem a fatura chegando antes de gastar no dia 2.
 */
export async function obterMesDoCalendario(
  workspaceId: string,
  referencia: string,
): Promise<Map<string, DiaDoCalendario>> {
  const { inicio, fim } = limitesDoMes(referencia);

  const [porDia, assinaturas, faturas, parcelas] = await Promise.all([
    db
      .select({
        data: transactions.date,
        gasto: sql`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
        entrada: sql`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
        n: sql`count(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspaceId),
          ne(transactions.status, "canceled"),
          ne(transactions.type, "transfer"),
          gte(transactions.date, inicio),
          lte(transactions.date, fim),
        ),
      )
      .groupBy(transactions.date),

    db
      .select({ nome: subscriptions.name, valor: subscriptions.amount, data: subscriptions.nextChargeAt })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.workspaceId, workspaceId),
          inArray(subscriptions.status, ["active", "trial"]),
          gte(subscriptions.nextChargeAt, inicio),
          lte(subscriptions.nextChargeAt, fim),
        ),
      ),

    db
      .select({ nome: creditCards.name, valor: cardInvoices.totalAmount, data: cardInvoices.dueDate })
      .from(cardInvoices)
      .innerJoin(creditCards, eq(creditCards.id, cardInvoices.cardId))
      .where(
        and(
          eq(cardInvoices.workspaceId, workspaceId),
          ne(cardInvoices.status, "paid"),
          gte(cardInvoices.dueDate, inicio),
          lte(cardInvoices.dueDate, fim),
        ),
      ),

    db
      .select({ nome: debts.name, valor: debtInstallments.amount, data: debtInstallments.dueDate })
      .from(debtInstallments)
      .innerJoin(debts, eq(debts.id, debtInstallments.debtId))
      .where(
        and(
          eq(debtInstallments.workspaceId, workspaceId),
          inArray(debtInstallments.status, ["pending", "overdue", "partial"]),
          gte(debtInstallments.dueDate, inicio),
          lte(debtInstallments.dueDate, fim),
        ),
      ),
  ]);

  const mapa = new Map<string, DiaDoCalendario>();

  const garantir = (data: string): DiaDoCalendario => {
    let dia = mapa.get(data);
    if (!dia) {
      dia = { data, gasto: 0, entrada: 0, lancamentos: 0, compromissos: [] };
      mapa.set(data, dia);
    }
    return dia;
  };

  for (const l of porDia) {
    const dia = garantir(l.data);
    dia.gasto = Number(l.gasto);
    dia.entrada = Number(l.entrada);
    dia.lancamentos = Number(l.n);
  }

  for (const a of assinaturas) {
    if (a.data) garantir(a.data).compromissos.push({ nome: a.nome, valor: a.valor, tipo: "assinatura" });
  }
  for (const f of faturas) {
    garantir(f.data).compromissos.push({ nome: `Fatura ${f.nome}`, valor: f.valor, tipo: "fatura" });
  }
  for (const p of parcelas) {
    garantir(p.data).compromissos.push({ nome: p.nome, valor: p.valor, tipo: "divida" });
  }

  return mapa;
}

/** Lancamentos de um dia especifico, para o painel de detalhe. */
export async function obterLancamentosDoDia(workspaceId: string, data: string) {
  return db
    .select({
      id: transactions.id,
      descricao: transactions.description,
      valor: transactions.amount,
      tipo: transactions.type,
      categoria: categories.name,
      categoriaCor: categories.color,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.workspaceId, workspaceId),
        eq(transactions.date, data),
        ne(transactions.status, "canceled"),
      ),
    )
    .orderBy(desc(transactions.amount));
}
