"use server";

import { and, db, eq, subscriptions } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paraDataLocal } from "@/lib/datas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { proximaCobranca, type Ciclo } from "@/lib/recorrencia";
import { exigirSessao } from "@/lib/session";

const esquema = z.object({
  nome: z.string().trim().min(2, "Dê um nome à assinatura.").max(60),
  valor: z.string().min(1, "Informe o valor."),
  ciclo: z.enum([
    "weekly",
    "biweekly",
    "monthly",
    "bimonthly",
    "quarterly",
    "semiannual",
    "yearly",
  ]),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  categoriaId: z.string().optional(),
  titularidade: z.enum(["conjunto", "meu"]),
});

export type EstadoAssinatura = { erro?: string; ok?: boolean };

export async function criarAssinatura(
  _anterior: EstadoAssinatura,
  form: FormData,
): Promise<EstadoAssinatura> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    nome: form.get("nome"),
    valor: form.get("valor"),
    ciclo: form.get("ciclo"),
    inicio: form.get("inicio"),
    categoriaId: form.get("categoriaId") || undefined,
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const centavos = parseMoney(d.valor);

  if (centavos <= 0) return { erro: "O valor precisa ser maior que zero." };

  const hoje = paraDataLocal();

  await db.insert(subscriptions).values({
    id: newId(),
    workspaceId: workspace.workspaceId,
    ownerId: d.titularidade === "conjunto" ? null : usuario.id,
    name: d.nome,
    amount: centavos,
    cycle: d.ciclo as Ciclo,
    startedAt: d.inicio,
    // Calculada na criacao para o calendario e os avisos ja' funcionarem
    // sem depender de nenhum job ter rodado.
    nextChargeAt: proximaCobranca(d.inicio, d.ciclo as Ciclo, hoje),
    categoryId: d.categoriaId || null,
    status: "active",
  });

  revalidatePath("/assinaturas");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Edita a assinatura.
 *
 * `nextChargeAt` e' recalculado a partir do inicio e do ciclo novos, e nao
 * preservado: mudar de mensal para anual mantendo a data antiga deixaria a
 * assinatura cobrando no ritmo velho no calendario e nos avisos.
 *
 * Assinatura pausada continua com a proxima cobranca nula — ela so' volta a
 * ter data quando for reativada.
 */
export async function editarAssinatura(
  _anterior: EstadoAssinatura,
  form: FormData,
): Promise<EstadoAssinatura> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.extend({ id: z.string().min(1) }).safeParse({
    id: form.get("id"),
    nome: form.get("nome"),
    valor: form.get("valor"),
    ciclo: form.get("ciclo"),
    inicio: form.get("inicio"),
    categoriaId: form.get("categoriaId") || undefined,
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const centavos = parseMoney(d.valor);

  if (centavos <= 0) return { erro: "O valor precisa ser maior que zero." };

  const [atual] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(and(eq(subscriptions.id, d.id), eq(subscriptions.workspaceId, workspace.workspaceId)))
    .limit(1);

  if (!atual) return { erro: "Assinatura não encontrada." };

  const cobrando = atual.status === "active" || atual.status === "trial";

  await db
    .update(subscriptions)
    .set({
      ownerId: d.titularidade === "conjunto" ? null : usuario.id,
      name: d.nome,
      amount: centavos,
      cycle: d.ciclo as Ciclo,
      startedAt: d.inicio,
      nextChargeAt: cobrando
        ? proximaCobranca(d.inicio, d.ciclo as Ciclo, paraDataLocal())
        : null,
      categoryId: d.categoriaId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(subscriptions.id, d.id), eq(subscriptions.workspaceId, workspace.workspaceId)));

  revalidatePath("/assinaturas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Exclui a assinatura de vez.
 *
 * Diferente das outras entidades, aqui nao ha' historico a preservar: a
 * assinatura nao gera lancamento por conta propria (quem lanca a cobranca e' o
 * usuario, como despesa comum). Cancelar continua existindo para quem quer
 * manter o registro de que ja' assinou.
 */
export async function excluirAssinatura(id: string): Promise<EstadoAssinatura> {
  const { workspace } = await exigirSessao();

  await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.workspaceId, workspace.workspaceId)));

  revalidatePath("/assinaturas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

export async function alternarAssinatura(id: string): Promise<EstadoAssinatura> {
  const { workspace } = await exigirSessao();

  const [atual] = await db
    .select({ status: subscriptions.status, inicio: subscriptions.startedAt, ciclo: subscriptions.cycle })
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.workspaceId, workspace.workspaceId)))
    .limit(1);

  if (!atual) return { erro: "Assinatura não encontrada." };

  const pausando = atual.status === "active" || atual.status === "trial";

  await db
    .update(subscriptions)
    .set({
      status: pausando ? "paused" : "active",
      // Ao reativar, a proxima cobranca e' recalculada a partir de hoje —
      // manter a data velha faria a assinatura nascer "vencida".
      nextChargeAt: pausando
        ? null
        : proximaCobranca(atual.inicio, atual.ciclo as Ciclo, paraDataLocal()),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id));

  revalidatePath("/assinaturas");
  revalidatePath("/");
  return { ok: true };
}

export async function cancelarAssinatura(id: string): Promise<EstadoAssinatura> {
  const { workspace } = await exigirSessao();

  await db
    .update(subscriptions)
    .set({
      status: "canceled",
      canceledAt: paraDataLocal(),
      nextChargeAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.workspaceId, workspace.workspaceId)));

  revalidatePath("/assinaturas");
  revalidatePath("/");
  return { ok: true };
}
