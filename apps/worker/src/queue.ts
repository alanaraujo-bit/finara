import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { sincronizarConexao } from "./sync";

export const NOME_FILA = "finara-openfinance";

export type JobSync = { connectionId: string; motivo: string };

/**
 * O BullMQ exige `maxRetriesPerRequest: null` — sem isso o ioredis aborta
 * comandos bloqueantes e o worker para de consumir a fila silenciosamente.
 */
const conexao = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const fila = new Queue<JobSync>(NOME_FILA, { connection: conexao });

const OPCOES: JobsOptions = {
  attempts: 3,
  // Espera crescente: banco fora do ar volta em minutos, nao em milissegundos.
  backoff: { type: "exponential", delay: 10_000 },
  removeOnComplete: { age: 3600, count: 200 },
  removeOnFail: { age: 86_400 },
};

/**
 * Enfileira a sincronizacao.
 *
 * O jobId amarra a conexao: se chegarem tres webhooks do mesmo item enquanto
 * um sync ja' esta' na fila, o BullMQ descarta os repetidos em vez de rodar
 * a importacao tres vezes em paralelo sobre as mesmas linhas.
 */
export async function enfileirarSync(dados: JobSync) {
  return fila.add("sync", dados, { ...OPCOES, jobId: `sync:${dados.connectionId}` });
}

export function iniciarWorker() {
  const worker = new Worker<JobSync>(
    NOME_FILA,
    async (job) => {
      console.info(`[sync] iniciando conexao=${job.data.connectionId} motivo=${job.data.motivo}`);
      const r = await sincronizarConexao(job.data.connectionId);
      console.info(
        `[sync] concluido conexao=${job.data.connectionId} contas=${r.contasVinculadas} criadas=${r.criadas} atualizadas=${r.atualizadas}`,
      );
      return r;
    },
    {
      connection: conexao,
      // Uma conexao por vez: a API do Pluggy tem limite de taxa, e importar
      // varias em paralelo so' antecipa o 429.
      concurrency: 2,
    },
  );

  worker.on("failed", (job, erro) => {
    console.error(`[sync] falhou conexao=${job?.data.connectionId}:`, erro.message);
  });

  return worker;
}
