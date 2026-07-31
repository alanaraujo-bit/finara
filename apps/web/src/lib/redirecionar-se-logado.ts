import { redirect } from "next/navigation";
import { obterSessao } from "./session";

/** Caminho interno seguro — barra open redirect via `?proximo=`. */
export function destinoSeguro(proximo: string | undefined): string {
  if (!proximo) return "/";
  if (!proximo.startsWith("/")) return "/";
  if (proximo.startsWith("//")) return "/";
  return proximo;
}

/**
 * Tira da tela de login quem ja' esta' autenticado, respeitando o destino
 * pedido (ex.: voltar pro convite em vez de cair no dashboard).
 */
export async function redirecionarSeLogado(proximo: string | undefined) {
  const sessao = await obterSessao();
  if (sessao) redirect(destinoSeguro(proximo));
}
