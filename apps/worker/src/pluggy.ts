import { PluggyClient } from "pluggy-sdk";
import { env } from "./env";

export const pluggy = new PluggyClient({
  clientId: env.pluggyClientId,
  clientSecret: env.pluggyClientSecret,
});

/**
 * Comparacao de tempo constante do segredo do webhook.
 *
 * O Pluggy nao assina os eventos, entao este segredo na URL e' a unica
 * barreira de autenticidade. Comparar com === vazaria, pelo tempo de
 * resposta, quantos caracteres o atacante ja' acertou.
 */
export function segredoConfere(recebido: string): boolean {
  const esperado = env.webhookSecret;
  if (!recebido || esperado.length !== recebido.length) return false;

  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  }
  return diferenca === 0;
}
