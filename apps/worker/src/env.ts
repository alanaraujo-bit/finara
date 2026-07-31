/**
 * Variaveis do worker, validadas na partida.
 *
 * Falhar aqui, ao subir, e' de proposito: um worker que sobe sem credencial
 * fica de pe' no Railway aceitando webhook e descartando tudo em silencio —
 * o pior tipo de falha, porque parece que esta' funcionando.
 */
function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variavel ${nome} nao definida. O worker nao sobe sem ela.`);
  }
  return valor;
}

export const env = {
  databaseUrl: obrigatoria("DATABASE_URL"),
  redisUrl: obrigatoria("REDIS_URL"),
  pluggyClientId: obrigatoria("PLUGGY_CLIENT_ID"),
  pluggyClientSecret: obrigatoria("PLUGGY_CLIENT_SECRET"),
  webhookSecret: obrigatoria("PLUGGY_WEBHOOK_SECRET"),
  // O Railway injeta a porta; fora dele caimos num padrao util em dev.
  port: Number(process.env.PORT ?? 8080),
};
