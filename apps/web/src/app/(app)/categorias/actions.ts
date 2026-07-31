"use server";

import {
  and,
  categories,
  db,
  debts,
  eq,
  ne,
  receivables,
  sql,
  subscriptions,
  transactions,
} from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { newId } from "@/lib/id";
import { COR_PADRAO, ehCorValida, ehIconeValido, ICONE_PADRAO } from "@/lib/icones-categoria";
import { parseMoney } from "@/lib/money";
import { exigirSessao } from "@/lib/session";

export type EstadoCategoria = { erro?: string; ok?: boolean };

const esquema = z.object({
  nome: z.string().trim().min(2, "Dê um nome à categoria.").max(40, "Nome muito longo."),
  tipo: z.enum(["expense", "income"]),
  cor: z.string().refine(ehCorValida, "Cor inválida."),
  icone: z.string().refine(ehIconeValido, "Ícone inválido."),
  // Vazio ou zero = sem teto. A string crua vai para o parseMoney.
  teto: z.string().optional(),
});

function ler(form: FormData) {
  return esquema.safeParse({
    nome: form.get("nome"),
    tipo: form.get("tipo"),
    cor: form.get("cor") ?? COR_PADRAO,
    icone: form.get("icone") ?? ICONE_PADRAO,
    teto: form.get("teto") ?? "",
  });
}

/**
 * Nome repetido dentro do mesmo tipo. Duas "Alimentação" de despesa deixam o
 * grafico de gastos mentiroso — o valor aparece partido em duas fatias que o
 * usuario le como categorias diferentes.
 */
async function nomeJaExiste(params: {
  workspaceId: string;
  nome: string;
  tipo: "expense" | "income";
  ignorarId?: string;
}): Promise<boolean> {
  const { workspaceId, nome, tipo, ignorarId } = params;

  const [linha] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.workspaceId, workspaceId),
        eq(categories.kind, tipo),
        sql`lower(${categories.name}) = lower(${nome})`,
        ignorarId ? ne(categories.id, ignorarId) : undefined,
      ),
    )
    .limit(1);

  return Boolean(linha);
}

/** Telas que mostram nome ou cor de categoria e precisam reler apos a mudanca. */
function revalidarTelasDeCategoria() {
  revalidatePath("/categorias");
  revalidatePath("/lancamentos");
  revalidatePath("/");
}

export async function criarCategoria(
  _anterior: EstadoCategoria,
  form: FormData,
): Promise<EstadoCategoria> {
  const { workspace } = await exigirSessao();

  const parsed = ler(form);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { nome, tipo, cor, icone, teto } = parsed.data;

  if (await nomeJaExiste({ workspaceId: workspace.workspaceId, nome, tipo })) {
    return { erro: `Já existe uma categoria de ${tipo === "expense" ? "despesa" : "receita"} com esse nome.` };
  }

  const centavosTeto = parseMoney(teto ?? "");

  // Entra no fim da lista, sem reordenar o que o usuario ja' conhece.
  const [ultima] = await db
    .select({ maior: sql<number>`coalesce(max(${categories.sortOrder}), 0)::int` })
    .from(categories)
    .where(eq(categories.workspaceId, workspace.workspaceId));

  await db.insert(categories).values({
    id: newId(),
    workspaceId: workspace.workspaceId,
    name: nome,
    kind: tipo,
    color: cor,
    icon: icone,
    monthlyBudget: centavosTeto > 0 ? centavosTeto : null,
    sortOrder: (ultima?.maior ?? 0) + 1,
  });

  revalidarTelasDeCategoria();
  return { ok: true };
}

export async function editarCategoria(
  _anterior: EstadoCategoria,
  form: FormData,
): Promise<EstadoCategoria> {
  const { workspace } = await exigirSessao();

  const id = String(form.get("id") ?? "");
  if (!id) return { erro: "Categoria não informada." };

  const parsed = ler(form);
  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { nome, tipo, cor, icone, teto } = parsed.data;

  if (await nomeJaExiste({ workspaceId: workspace.workspaceId, nome, tipo, ignorarId: id })) {
    return { erro: "Já existe outra categoria com esse nome." };
  }

  const centavosTeto = parseMoney(teto ?? "");

  // O `and` com workspaceId nao e' redundante: sem ele, um id adivinhado
  // deixaria alguem editar categoria de outro espaco.
  const alteradas = await db
    .update(categories)
    .set({
      name: nome,
      kind: tipo,
      color: cor,
      icon: icone,
      monthlyBudget: centavosTeto > 0 ? centavosTeto : null,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspace.workspaceId)))
    .returning({ id: categories.id });

  if (alteradas.length === 0) return { erro: "Categoria não encontrada." };

  revalidarTelasDeCategoria();
  return { ok: true };
}

export async function arquivarCategoria(id: string): Promise<EstadoCategoria> {
  const { workspace } = await exigirSessao();

  // Arquivar some da lista e dos seletores, mas preserva o historico: os
  // lancamentos antigos continuam apontando para ela.
  await db
    .update(categories)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspace.workspaceId)));

  revalidarTelasDeCategoria();
  return { ok: true };
}

export async function restaurarCategoria(id: string): Promise<EstadoCategoria> {
  const { workspace } = await exigirSessao();

  await db
    .update(categories)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspace.workspaceId)));

  revalidarTelasDeCategoria();
  return { ok: true };
}

/**
 * Exclusao definitiva, permitida so' quando nada aponta para a categoria.
 *
 * As chaves estrangeiras sao `ON DELETE SET NULL`: apagar uma categoria em uso
 * nao daria erro nenhum, apenas deixaria os lancamentos orfaos sem aviso. Por
 * isso a checagem e' aqui, e o caminho para quem ja' tem historico e' arquivar.
 */
export async function excluirCategoria(id: string): Promise<EstadoCategoria> {
  const { workspace } = await exigirSessao();

  const [categoria] = await db
    .select({ id: categories.id, padrao: categories.isSystem })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspace.workspaceId)))
    .limit(1);

  if (!categoria) return { erro: "Categoria não encontrada." };
  if (categoria.padrao) {
    return { erro: "Categoria padrão não pode ser excluída. Arquive-a se não usa." };
  }

  const [uso] = await db
    .select({
      lancamentos: sql<number>`(select count(*)::int from ${transactions} where ${transactions.categoryId} = ${id})`,
      assinaturas: sql<number>`(select count(*)::int from ${subscriptions} where ${subscriptions.categoryId} = ${id})`,
      recebiveis: sql<number>`(select count(*)::int from ${receivables} where ${receivables.categoryId} = ${id})`,
      dividas: sql<number>`(select count(*)::int from ${debts} where ${debts.categoryId} = ${id})`,
    })
    .from(categories)
    .where(eq(categories.id, id));

  const total =
    (uso?.lancamentos ?? 0) + (uso?.assinaturas ?? 0) + (uso?.recebiveis ?? 0) + (uso?.dividas ?? 0);

  if (total > 0) {
    return {
      erro: `Essa categoria está em uso em ${total} ${total === 1 ? "registro" : "registros"}. Arquive-a para tirá-la da lista sem perder o histórico.`,
    };
  }

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.workspaceId, workspace.workspaceId)));

  revalidarTelasDeCategoria();
  return { ok: true };
}
