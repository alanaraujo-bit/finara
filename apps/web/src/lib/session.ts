import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { obterWorkspaceDoUsuario } from "./workspace";

/**
 * Sessao atual, ou null. Envolvido em `cache` do React para que varios
 * componentes da mesma pagina compartilhem uma unica leitura por request.
 */
export const obterSessao = cache(async () => {
  // No Next 16 `headers()` e' assincrono — o acesso sincrono foi removido.
  return auth.api.getSession({ headers: await headers() });
});

/**
 * Sessao + workspace, exigindo login. Use em toda pagina do app.
 *
 * Se o usuario existe mas nao tem workspace (falha no hook de cadastro, ou
 * conta criada antes do modo casal), mandamos pro onboarding em vez de
 * estourar — a pessoa consegue se recuperar sozinha.
 */
export const exigirSessao = cache(async () => {
  const sessao = await obterSessao();

  if (!sessao) {
    redirect("/entrar");
  }

  const workspace = await obterWorkspaceDoUsuario(sessao.user.id);

  if (!workspace) {
    redirect("/comecar");
  }

  return { usuario: sessao.user, workspace };
});
