import { PluggyClient } from "pluggy-sdk";

/**
 * Cliente do Pluggy. Vive SO' no servidor — o segredo nunca pode chegar ao
 * browser. Este arquivo nao pode ser importado por nenhum componente com
 * "use client"; se for, o build vaza a credencial no bundle.
 */

let cliente: PluggyClient | null = null;

export function obterPluggy(): PluggyClient {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET nao definidas. Preencha em apps/web/.env.local (e nas variaveis da Vercel para producao).",
    );
  }

  // O SDK guarda um apiKey interno com validade; reaproveitar a instancia
  // evita reautenticar a cada request.
  cliente ??= new PluggyClient({ clientId, clientSecret });
  return cliente;
}

/**
 * URL que o Pluggy chama nos eventos. Aponta para o WORKER no Railway, nao
 * para este app na Vercel, por dois motivos:
 *
 *  - a implantacao da Vercel esta' protegida por login, entao o Pluggy
 *    receberia 401 e nenhum evento chegaria;
 *  - a importacao de extrato nao cabe nos 5 segundos que a documentacao
 *    exige de resposta, nem sobrevive ao fim de uma funcao serverless.
 *
 * Funciona tambem em desenvolvimento: o worker e' publico, entao um banco
 * conectado do localhost e' sincronizado normalmente la'.
 */
export function urlWebhook(): string | undefined {
  const base = process.env.WORKER_URL;
  const segredo = process.env.PLUGGY_WEBHOOK_SECRET;

  if (!base || !segredo) return undefined;

  return `${base.replace(/\/$/, "")}/webhooks/pluggy/${segredo}`;
}

/**
 * O Pluggy nao assina os webhooks. A defesa entao e' dupla:
 *  1. a URL carrega um segredo que so' nos e o Pluggy conhecemos;
 *  2. o corpo do evento e' tratado como mero aviso — o dado que importa e'
 *     rebuscado na API com as nossas credenciais (ver `confirmarItem`).
 * Assim, mesmo que alguem descubra a URL, nao consegue injetar dado falso.
 */
export function segredoWebhookConfere(recebido: string): boolean {
  const esperado = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!esperado || !recebido) return false;
  if (esperado.length !== recebido.length) return false;

  // Comparacao de tempo constante: comparar com === vaza, pelo tempo de
  // resposta, quantos caracteres iniciais o atacante acertou.
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  }
  return diferenca === 0;
}

/**
 * Busca o item direto na API do Pluggy. E' isto que transforma um webhook
 * nao autenticado em informacao confiavel: se o item nao existe sob as
 * nossas credenciais, o evento e' descartado.
 */
export async function confirmarItem(itemId: string) {
  try {
    return await obterPluggy().fetchItem(itemId);
  } catch {
    return null;
  }
}
