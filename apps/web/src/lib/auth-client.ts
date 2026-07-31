"use client";

import { createAuthClient } from "better-auth/react";

/**
 * SEM `baseURL` — de proposito, e nao por esquecimento.
 *
 * Vazio significa "mesma origem de quem abriu a pagina", que e' sempre o certo
 * aqui: a Vercel serve o app e a API no mesmo dominio, seja qual for o endereco
 * usado para chegar.
 *
 * Passar `NEXT_PUBLIC_APP_URL` parecia inofensivo e nao era. Variavel
 * `NEXT_PUBLIC_*` e' substituida por texto no momento do BUILD, entao o pacote
 * do navegador saia com UM endereco cravado dentro. Um projeto na Vercel
 * responde por varios (dominio de producao, apelido do projeto, apelido do
 * branch, URL do deploy): abrindo por qualquer um que nao fosse o cravado, o
 * login virava pedido entre origens diferentes e morria no CORS, antes mesmo de
 * chegar ao servidor. O mesmo valia para pre-visualizacoes, que ganham endereco
 * novo a cada commit.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
