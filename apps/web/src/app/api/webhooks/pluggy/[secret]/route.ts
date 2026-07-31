import { db, eq, openFinanceConnections, openFinanceSyncRuns } from "@finara/db";
import { after } from "next/server";
import { newId } from "@/lib/id";
import { confirmarItem, segredoWebhookConfere } from "@/lib/pluggy";

/**
 * Recebe os eventos do Pluggy.
 *
 * Regra dura da documentacao: responder 2XX em ate' 5 segundos. Por isso o
 * corpo do handler so' valida e devolve; qualquer trabalho vai pro `after()`,
 * que roda depois da resposta ja' ter saido.
 *
 * O segredo esta' no caminho da URL porque o Pluggy nao assina os webhooks —
 * nao ha' cabecalho de assinatura pra conferir. E, mesmo com o segredo certo,
 * NAO confiamos no corpo: o item e' rebuscado na API do Pluggy com as nossas
 * credenciais antes de qualquer escrita no banco.
 */
export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;

  if (!segredoWebhookConfere(secret)) {
    // 404 em vez de 403: nao confirma pra quem sonda que a rota existe.
    return new Response("Not found", { status: 404 });
  }

  let evento: { event?: string; eventId?: string; itemId?: string; error?: unknown };

  try {
    evento = await req.json();
  } catch {
    return Response.json({ received: false }, { status: 400 });
  }

  const { event, eventId, itemId } = evento;

  if (!event || !eventId) {
    return Response.json({ received: false }, { status: 400 });
  }

  // Nada de logar o payload inteiro: ele carrega identificadores de conta
  // bancaria do usuario, e log de plataforma e' retido e indexado.
  console.info(`[pluggy] evento ${event} (${eventId})`);

  if (itemId) {
    after(async () => {
      try {
        await processarEventoDeItem({ event, eventId, itemId });
      } catch (erro) {
        console.error(`[pluggy] falha ao processar ${event} (${eventId}):`, erro);
      }
    });
  }

  return Response.json({ received: true });
}

/**
 * Reflete o evento no estado da conexao.
 *
 * A importacao de lancamentos NAO acontece aqui — ela e' longa e pertence ao
 * worker no Railway, que ainda nao existe. O que fazemos e' marcar a conexao
 * como "precisa sincronizar" e registrar a corrida, para o worker pegar.
 */
async function processarEventoDeItem(params: {
  event: string;
  eventId: string;
  itemId: string;
}) {
  const { event, itemId } = params;

  // A fonte da verdade e' a API, nao o corpo do webhook.
  const item = await confirmarItem(itemId);

  if (!item) {
    console.warn(`[pluggy] item ${itemId} nao confere sob nossas credenciais; evento ignorado`);
    return;
  }

  const [conexao] = await db
    .select({ id: openFinanceConnections.id })
    .from(openFinanceConnections)
    .where(eq(openFinanceConnections.externalItemId, itemId))
    .limit(1);

  if (!conexao) {
    // Pode chegar antes do usuario terminar o fluxo no browser. Sem conexao
    // registrada nao ha' workspace a que atribuir o dado — descartamos.
    console.warn(`[pluggy] item ${itemId} sem conexao registrada; evento ignorado`);
    return;
  }

  const status =
    event === "item/error"
      ? "error"
      : event === "item/waiting_user_input" || event === "item/waiting_user_action"
        ? "needs_action"
        : event === "item/deleted"
          ? "disconnected"
          : "active";

  await db
    .update(openFinanceConnections)
    .set({
      status,
      statusDetail: item.error?.message ?? null,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(openFinanceConnections.id, conexao.id));

  if (event === "item/updated" || event === "item/created") {
    // Marca a corrida pro worker importar os lancamentos.
    await db.insert(openFinanceSyncRuns).values({
      id: newId(),
      connectionId: conexao.id,
      status: "running",
    });
  }
}
