import {
  and,
  asc,
  categories,
  creditCards,
  db,
  desc,
  eq,
  financialAccounts,
  sql,
  transactions,
  workspaceMembers,
} from "@finara/db";

export async function listarContas(workspaceId: string) {
  return db
    .select()
    .from(financialAccounts)
    .where(
      and(eq(financialAccounts.workspaceId, workspaceId), eq(financialAccounts.isArchived, false)),
    )
    .orderBy(asc(financialAccounts.sortOrder), asc(financialAccounts.name));
}

export async function listarCartoes(workspaceId: string) {
  return db
    .select()
    .from(creditCards)
    .where(and(eq(creditCards.workspaceId, workspaceId), eq(creditCards.isArchived, false)))
    .orderBy(asc(creditCards.sortOrder), asc(creditCards.name));
}

export async function listarCategorias(workspaceId: string) {
  return db
    .select({
      id: categories.id,
      nome: categories.name,
      tipo: categories.kind,
      cor: categories.color,
      icone: categories.icon,
    })
    .from(categories)
    .where(and(eq(categories.workspaceId, workspaceId), eq(categories.isArchived, false)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listarMembrosSimples(workspaceId: string) {
  return db
    .select({
      userId: workspaceMembers.userId,
      nome: workspaceMembers.displayName,
      cor: workspaceMembers.color,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export type FiltroLancamentos = {
  workspaceId: string;
  limite?: number;
  offset?: number;
};

/** Extrato completo, com os nomes ja' resolvidos para a tela. */
export async function listarLancamentos({ workspaceId, limite = 50, offset = 0 }: FiltroLancamentos) {
  return db
    .select({
      id: transactions.id,
      descricao: transactions.description,
      valor: transactions.amount,
      tipo: transactions.type,
      status: transactions.status,
      data: transactions.date,
      ownerId: transactions.ownerId,
      categoria: categories.name,
      categoriaCor: categories.color,
      origem: sql<string | null>`coalesce(${financialAccounts.name}, ${creditCards.name})`,
      // Lancamento importado tem connectionId; o manual, nao.
      importado: sql<boolean>`${transactions.connectionId} is not null`,
      parcela: transactions.installmentNumber,
      parcelasTotal: transactions.installmentTotal,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(financialAccounts, eq(financialAccounts.id, transactions.accountId))
    .leftJoin(creditCards, eq(creditCards.id, transactions.cardId))
    .where(eq(transactions.workspaceId, workspaceId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limite)
    .offset(offset);
}

export async function contarLancamentos(workspaceId: string): Promise<number> {
  const [linha] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(eq(transactions.workspaceId, workspaceId));
  return linha?.n ?? 0;
}
