import { db, eq, openFinanceConnections } from "@finara/db";
import Fastify from "fastify";
import { env } from "./env";
import { pluggy, segredoConfere } from "./pluggy";
import { enfileirarSync, iniciarWorker } from "./queue";

/**
 * Worker do Finara.
 *
 * Faz duas coisas no mesmo processo:
 *  1. Serve o endpoint de webhook do Pluggy (HTTP).
 *  2. Consome a fila que esse webhook alimenta (BullMQ/Redis).
 *
 * Ficou aqui, e nao na Vercel, por tres motivos concretos:
 *  - a implantacao da Vercel esta' protegida por login, entao o Pluggy
 *    receberia 401 ao chamar o webhook;
 *  - a documentacao exige resposta em 5s, e importar meses de extrato nao
 *    cabe nessa janela;
 *  - funcao serverless morre ao responder, entao nao ha' onde continuar o
 *    trabalho pesado.
 */
const app = Fastify({
  logger: {
    level: "info",
    serializers: {
      /**
       * Mascara o segredo do webhook antes de qualquer coisa ir pro log.
       *
       * Ele viaja no CAMINHO da URL, e o log padrao do Fastify registra a URL
       * inteira — o que colocaria a credencial em texto puro no painel do
       * Railway, onde fica retida e visivel pra quem tiver acesso ao projeto.
       */
      req(requisicao) {
        return {
          method: requisicao.method,
          url: requisicao.url.replace(
            /\/webhooks\/pluggy\/[^/?]+/,
            "/webhooks/pluggy/<oculto>",
          ),
          remoteAddress: requisicao.ip,
        };
      },
    },
  },
  // O Railway fica atras de proxy; sem isto o IP do cliente vem errado.
  trustProxy: true,
});

app.get("/health", async () => ({ ok: true, servico: "finara-worker" }));

/**
 * Webhook do Pluggy. O segredo vai no caminho porque o Pluggy nao assina os
 * eventos — nao ha' cabecalho de assinatura pra conferir.
 */
app.post<{ Params: { secret: string }; Body: Record<string, unknown> }>(
  "/webhooks/pluggy/:secret",
  async (req, reply) => {
    if (!segredoConfere(req.params.secret)) {
      // 404 nao confirma pra quem sonda que a rota existe.
      return reply.code(404).send({ error: "Not found" });
    }

    const evento = req.body as { event?: string; eventId?: string; itemId?: string };

    if (!evento?.event || !evento.eventId) {
      return reply.code(400).send({ received: false });
    }

    // Sem o payload no log: ele carrega identificador de conta bancaria.
    req.log.info({ evento: evento.event, eventId: evento.eventId }, "webhook recebido");

    // Responde JA'. O trabalho vai pra fila — a regra dos 5 segundos e' o que
    // impede o Pluggy de considerar o webhook falho e reenviar tudo.
    reply.send({ received: true });

    if (!evento.itemId) return;

    try {
      await processar(evento.event, evento.itemId);
    } catch (erro) {
      req.log.error({ erro }, "falha ao processar evento");
    }
  },
);

async function processar(event: string, itemId: string) {
  // O corpo do webhook nao e' fonte de verdade: confirmamos o item na API do
  // Pluggy com as nossas credenciais antes de mexer no banco.
  const item = await pluggy.fetchItem(itemId).catch(() => null);

  if (!item) {
    app.log.warn({ itemId }, "item nao confere sob nossas credenciais; ignorado");
    return;
  }

  const [conexao] = await db
    .select({ id: openFinanceConnections.id })
    .from(openFinanceConnections)
    .where(eq(openFinanceConnections.externalItemId, itemId))
    .limit(1);

  if (!conexao) {
    // Chega antes do usuario concluir o fluxo no browser. Sem conexao
    // registrada nao ha' workspace a que atribuir o dado.
    app.log.warn({ itemId }, "sem conexao registrada; evento ignorado");
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
    .set({ status, statusDetail: item.error?.message ?? null, updatedAt: new Date() })
    .where(eq(openFinanceConnections.id, conexao.id));

  // So' vale importar quando o item esta' saudavel e tem dado novo.
  if (event === "item/created" || event === "item/updated") {
    await enfileirarSync({ connectionId: conexao.id, motivo: event });
  }
}

const worker = iniciarWorker();

async function encerrar(sinal: string) {
  app.log.info(`recebido ${sinal}, encerrando...`);
  // Fecha o worker antes do HTTP: deixa o job em andamento terminar em vez
  // de morrer no meio de uma importacao e deixar dado pela metade.
  await worker.close();
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => void encerrar("SIGTERM"));
process.on("SIGINT", () => void encerrar("SIGINT"));

app.listen({ port: env.port, host: "0.0.0.0" }, (erro, endereco) => {
  if (erro) {
    app.log.error(erro);
    process.exit(1);
  }
  app.log.info(`worker do Finara ouvindo em ${endereco}`);
});
