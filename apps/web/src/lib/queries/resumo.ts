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
  financialAccounts,
  gte,
  inArray,
  lte,
  ne,
  receivables,
  sql,
  subscriptions,
  transactions,
} from "@finara/db";
import { limitesDoMes, mesReferencia, paraDataLocal, somarDias } from "@/lib/datas";

/**
 * Agregados vem do Postgres como string quando a coluna e' bigint — o driver
 * nao arrisca estourar o Number. Como nossos valores sao centavos e cabem
 * folgado em double, convertemos aqui, num lugar so'.
 */
function n(valor: unknown): number {
  return Number(valor ?? 0);
}

export type Resumo = {
  saldoTotal: number;
  entradas: number;
  saidas: number;
  aReceber: number;
  dividasAbertas: number;
  variacaoMes: number | null;
  totalContas: number;
};

export async function obterResumo(workspaceId: string, referencia = mesReferencia()): Promise<Resumo> {
  const { inicio, fim } = limitesDoMes(referencia);

  const [saldo] = await db
    .select({
      total: sql`coalesce(sum(${financialAccounts.currentBalance}), 0)`,
      contas: sql`count(*)`,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.workspaceId, workspaceId),
        eq(financialAccounts.isArchived, false),
        eq(financialAccounts.excludeFromTotals, false),
      ),
    );

  // Entradas e saidas do mes numa varredura so'.
  const [fluxo] = await db
    .select({
      entradas: sql`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
      saidas: sql`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.workspaceId, workspaceId),
        ne(transactions.status, "canceled"),
        // Transferencia nao e' entrada nem saida: so' muda o dinheiro de lugar.
        ne(transactions.type, "transfer"),
        gte(transactions.date, inicio),
        lte(transactions.date, fim),
      ),
    );

  const [receber] = await db
    .select({
      total: sql`coalesce(sum(${receivables.amount} - ${receivables.receivedAmount}), 0)`,
    })
    .from(receivables)
    .where(
      and(
        eq(receivables.workspaceId, workspaceId),
        inArray(receivables.status, ["pending", "overdue", "partial"]),
      ),
    );

  const [divida] = await db
    .select({
      total: sql`coalesce(sum(${debts.totalAmount} - ${debts.paidAmount}), 0)`,
    })
    .from(debts)
    .where(and(eq(debts.workspaceId, workspaceId), eq(debts.status, "active")));

  // Variacao: saidas deste mes contra o anterior. Sem mes anterior, nao ha'
  // comparacao honesta a fazer — devolvemos null e a UI omite o selo.
  const anterior = mesAnterior(referencia);
  const limitesAnterior = limitesDoMes(anterior);

  const [fluxoAnterior] = await db
    .select({
      saidas: sql`coalesce(sum(${transactions.amount}), 0)`,
      linhas: sql`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.workspaceId, workspaceId),
        eq(transactions.type, "expense"),
        ne(transactions.status, "canceled"),
        gte(transactions.date, limitesAnterior.inicio),
        lte(transactions.date, limitesAnterior.fim),
      ),
    );

  const saidasAtual = n(fluxo?.saidas);
  const saidasAnterior = n(fluxoAnterior?.saidas);
  const houveMesAnterior = n(fluxoAnterior?.linhas) > 0;

  return {
    saldoTotal: n(saldo?.total),
    totalContas: n(saldo?.contas),
    entradas: n(fluxo?.entradas),
    saidas: saidasAtual,
    aReceber: n(receber?.total),
    dividasAbertas: n(divida?.total),
    variacaoMes:
      houveMesAnterior && saidasAnterior > 0
        ? ((saidasAtual - saidasAnterior) / saidasAnterior) * 100
        : null,
  };
}

function mesAnterior(referencia: string): string {
  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  return mes === 1
    ? `${ano - 1}-12`
    : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

export type GastoPorCategoria = {
  categoriaId: string | null;
  nome: string;
  cor: string;
  valor: number;
};

export async function obterGastosPorCategoria(
  workspaceId: string,
  referencia = mesReferencia(),
): Promise<GastoPorCategoria[]> {
  const { inicio, fim } = limitesDoMes(referencia);

  const linhas = await db
    .select({
      categoriaId: transactions.categoryId,
      nome: sql<string>`coalesce(${categories.name}, 'Sem categoria')`,
      cor: sql<string>`coalesce(${categories.color}, '#94a3b8')`,
      valor: sql`sum(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.workspaceId, workspaceId),
        eq(transactions.type, "expense"),
        ne(transactions.status, "canceled"),
        gte(transactions.date, inicio),
        lte(transactions.date, fim),
      ),
    )
    .groupBy(transactions.categoryId, categories.name, categories.color)
    .orderBy(desc(sql`sum(${transactions.amount})`))
    .limit(8);

  return linhas.map((l) => ({ ...l, valor: n(l.valor) }));
}

export type LancamentoResumido = {
  id: string;
  descricao: string;
  valor: number;
  tipo: "expense" | "income" | "transfer";
  data: string;
  categoria: string | null;
  categoriaCor: string | null;
  origem: string | null;
};

export async function obterLancamentosRecentes(
  workspaceId: string,
  limite = 8,
): Promise<LancamentoResumido[]> {
  return db
    .select({
      id: transactions.id,
      descricao: transactions.description,
      valor: transactions.amount,
      tipo: transactions.type,
      data: transactions.date,
      categoria: categories.name,
      categoriaCor: categories.color,
      // Mostra a conta ou o cartao, o que existir no lancamento.
      origem: sql<string | null>`coalesce(${financialAccounts.name}, ${creditCards.name})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(financialAccounts, eq(financialAccounts.id, transactions.accountId))
    .leftJoin(creditCards, eq(creditCards.id, transactions.cardId))
    .where(and(eq(transactions.workspaceId, workspaceId), ne(transactions.status, "canceled")))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limite);
}

export type Compromisso = {
  id: string;
  nome: string;
  valor: number;
  vence: string;
  tipo: "assinatura" | "fatura" | "divida";
};

/**
 * Proximos vencimentos dos proximos 30 dias, juntando as tres fontes:
 * assinaturas, faturas de cartao e parcelas de divida.
 */
export async function obterProximosVencimentos(
  workspaceId: string,
  dias = 30,
): Promise<Compromisso[]> {
  const hoje = paraDataLocal();
  const limite = somarDias(hoje, dias);

  const [assinaturas, faturas, parcelas] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        nome: subscriptions.name,
        valor: subscriptions.amount,
        vence: subscriptions.nextChargeAt,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.workspaceId, workspaceId),
          inArray(subscriptions.status, ["active", "trial"]),
          gte(subscriptions.nextChargeAt, hoje),
          lte(subscriptions.nextChargeAt, limite),
        ),
      ),

    db
      .select({
        id: cardInvoices.id,
        nome: creditCards.name,
        valor: cardInvoices.totalAmount,
        vence: cardInvoices.dueDate,
      })
      .from(cardInvoices)
      .innerJoin(creditCards, eq(creditCards.id, cardInvoices.cardId))
      .where(
        and(
          eq(cardInvoices.workspaceId, workspaceId),
          inArray(cardInvoices.status, ["open", "closed", "partial", "overdue"]),
          gte(cardInvoices.dueDate, hoje),
          lte(cardInvoices.dueDate, limite),
        ),
      ),

    db
      .select({
        id: debtInstallments.id,
        nome: debts.name,
        valor: debtInstallments.amount,
        vence: debtInstallments.dueDate,
      })
      .from(debtInstallments)
      .innerJoin(debts, eq(debts.id, debtInstallments.debtId))
      .where(
        and(
          eq(debtInstallments.workspaceId, workspaceId),
          inArray(debtInstallments.status, ["pending", "overdue", "partial"]),
          gte(debtInstallments.dueDate, hoje),
          lte(debtInstallments.dueDate, limite),
        ),
      ),
  ]);

  const tudo: Compromisso[] = [
    ...assinaturas.map((a) => ({ ...a, vence: a.vence!, tipo: "assinatura" as const })),
    ...faturas.map((f) => ({ ...f, nome: `Fatura ${f.nome}`, tipo: "fatura" as const })),
    ...parcelas.map((p) => ({ ...p, tipo: "divida" as const })),
  ];

  return tudo.sort((a, b) => a.vence.localeCompare(b.vence)).slice(0, 6);
}
