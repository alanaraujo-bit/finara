import { and, asc, categories, db, eq, sql, transactions } from "@finara/db";
import { limitesDoMes, mesReferencia } from "@/lib/datas";

export type CategoriaDaTela = {
  id: string;
  nome: string;
  tipo: "expense" | "income";
  cor: string;
  icone: string;
  tetoMensal: number | null;
  /** Criada no onboarding: pode ser editada e arquivada, nunca excluida. */
  padrao: boolean;
  arquivada: boolean;
  /** Movimentado no mes de referencia, em centavos. */
  noMes: number;
  /** Lancamentos ligados a ela, de qualquer epoca. Zero = pode excluir. */
  lancamentos: number;
};

/**
 * Categorias do espaco com o quanto cada uma movimentou no mes.
 *
 * O total do mes e o total historico saem do mesmo LEFT JOIN, com um `case`
 * separando um do outro — duas queries dariam o mesmo numero pagando duas
 * varreduras. Cancelado fica de fora do valor do mes (nao foi gasto), mas
 * conta como uso, porque a linha ainda referencia a categoria e impede a
 * exclusao.
 */
export async function listarCategoriasDaTela(
  workspaceId: string,
  referencia: string = mesReferencia(),
): Promise<CategoriaDaTela[]> {
  const { inicio, fim } = limitesDoMes(referencia);

  const linhas = await db
    .select({
      id: categories.id,
      nome: categories.name,
      tipo: categories.kind,
      cor: categories.color,
      icone: categories.icon,
      tetoMensal: categories.monthlyBudget,
      padrao: categories.isSystem,
      arquivada: categories.isArchived,
      noMes: sql`coalesce(sum(case
        when ${transactions.date} >= ${inicio}
         and ${transactions.date} <= ${fim}
         and ${transactions.status} <> 'canceled'
        then ${transactions.amount} else 0 end), 0)`,
      lancamentos: sql`count(${transactions.id})`,
    })
    .from(categories)
    .leftJoin(
      transactions,
      and(
        eq(transactions.categoryId, categories.id),
        eq(transactions.workspaceId, categories.workspaceId),
      ),
    )
    .where(eq(categories.workspaceId, workspaceId))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return linhas.map((l) => ({
    ...l,
    // Agregado de bigint chega como string do driver; centavos cabem em Number.
    noMes: Number(l.noMes ?? 0),
    lancamentos: Number(l.lancamentos ?? 0),
    tetoMensal: l.tetoMensal === null ? null : Number(l.tetoMensal),
  }));
}
