import { obterPluggy, urlWebhook } from "@/lib/pluggy";
import { obterSessao } from "@/lib/session";
import { obterWorkspaceDoUsuario } from "@/lib/workspace";

/**
 * Gera o Connect Token que o widget do Pluggy consome no browser.
 *
 * Duas coisas aqui sao deliberadas e diferem do exemplo da documentacao:
 *
 * 1. A rota EXIGE sessao. Um endpoint aberto deixaria qualquer um na internet
 *    emitir tokens contra a sua conta Pluggy — queimando cota e abrindo a
 *    porta pra vincular bancos ao seu ambiente.
 *
 * 2. O `clientUserId` vem da SESSAO, nunca do corpo da requisicao. Se viesse
 *    do corpo, bastaria mandar o id de outra pessoa pra amarrar uma conexao
 *    bancaria ao espaco financeiro dela.
 */
export async function POST() {
  const sessao = await obterSessao();

  if (!sessao) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const workspace = await obterWorkspaceDoUsuario(sessao.user.id);

  if (!workspace) {
    return Response.json({ error: "Sem espaço financeiro." }, { status: 403 });
  }

  try {
    const pluggy = obterPluggy();

    // Assinatura real do SDK: createConnectToken(itemId?, options?).
    // O primeiro argumento e' o item a atualizar — undefined para uma
    // conexao nova.
    const { accessToken } = await pluggy.createConnectToken(undefined, {
      clientUserId: sessao.user.id,
      webhookUrl: urlWebhook(),
      // Evita o usuario cadastrar o mesmo banco duas vezes por engano.
      avoidDuplicates: true,
    });

    return Response.json(
      { accessToken },
      // Token de curta duracao: nao pode ficar em cache de CDN nem do browser.
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (erro) {
    console.error("[pluggy] falha ao criar connect token:", erro);
    return Response.json({ error: "Não consegui iniciar a conexão." }, { status: 502 });
  }
}
