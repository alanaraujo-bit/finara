"use server";

import { and, db, eq, openFinanceConnections } from "@finara/db";
import { revalidatePath } from "next/cache";
import { newId } from "@/lib/id";
import { confirmarItem } from "@/lib/pluggy";
import { exigirSessao } from "@/lib/session";

export type ResultadoRegistro = { ok: true } | { ok: false; erro: string };

/**
 * Registra no Finara o vinculo que o usuario acabou de autorizar no widget.
 *
 * O `itemId` chega do browser, entao e' tratado como nao confiavel: antes de
 * gravar, o item e' buscado na API do Pluggy com as nossas credenciais. Se
 * nao existir la', nao vira registro aqui.
 */
export async function registrarConexao(itemId: string): Promise<ResultadoRegistro> {
  const { usuario, workspace } = await exigirSessao();

  if (!itemId || typeof itemId !== "string") {
    return { ok: false, erro: "Identificador de conexão inválido." };
  }

  const item = await confirmarItem(itemId);

  if (!item) {
    return { ok: false, erro: "Não consegui confirmar essa conexão no Pluggy." };
  }

  // Reconectar o mesmo banco atualiza o registro em vez de duplicar.
  const [existente] = await db
    .select({ id: openFinanceConnections.id })
    .from(openFinanceConnections)
    .where(
      and(
        eq(openFinanceConnections.workspaceId, workspace.workspaceId),
        eq(openFinanceConnections.externalItemId, itemId),
      ),
    )
    .limit(1);

  const dados = {
    institutionName: item.connector?.name ?? "Instituição",
    institutionLogoUrl: item.connector?.imageUrl ?? null,
    status: "active" as const,
    statusDetail: null,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existente) {
    await db
      .update(openFinanceConnections)
      .set(dados)
      .where(eq(openFinanceConnections.id, existente.id));
  } else {
    await db.insert(openFinanceConnections).values({
      id: newId(),
      workspaceId: workspace.workspaceId,
      connectedById: usuario.id,
      provider: "pluggy",
      externalItemId: itemId,
      ...dados,
    });
  }

  revalidatePath("/conexoes");
  return { ok: true };
}
