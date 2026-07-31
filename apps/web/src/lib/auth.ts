import {
  authAccounts,
  db,
  sessions,
  users,
  verifications,
} from "@finara/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { criarWorkspaceInicial } from "./workspace";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET nao definida — o login nao funciona sem ela.");
}

/**
 * ENDERECO DO PROPRIO APP
 *
 * O better-auth compara a origem de TODO pedido de login contra este valor e
 * recusa o que nao bater (`INVALID_ORIGIN`, HTTP 403) — e' a protecao contra
 * CSRF dele. Ou seja: errar aqui nao da' erro de configuracao, da' "login nao
 * funciona" sem explicacao nenhuma na tela.
 *
 * Era so' `?? "http://localhost:3000"`. Num deploy sem `BETTER_AUTH_URL`
 * definida, o servidor passava a acreditar que morava em localhost e recusava
 * o login vindo do proprio dominio de producao. Foi exatamente o que aconteceu
 * ao migrar o projeto de conta na Vercel.
 *
 * A cadeia de fallback nao existe por preguica de configurar: a Vercel injeta
 * `VERCEL_PROJECT_PRODUCTION_URL` sozinha em todo deploy, entao o app volta a
 * funcionar por conta propria mesmo que alguem esqueca a variavel. Mesmo
 * desenho que o `metadataBase` do `layout.tsx`.
 */
const enderecoDoApp =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/**
 * Um projeto na Vercel responde por VARIOS enderecos ao mesmo tempo: o dominio
 * de producao, o apelido fixo do projeto, o apelido do branch e a URL imutavel
 * de cada deploy. Todos servem o mesmo app, e o `baseURL` acima so' cobre um
 * deles — nos outros, o login voltaria a dar 403.
 *
 * Tudo vem de variavel que a propria Vercel injeta, e nao de dominio escrito
 * aqui: assim as pre-visualizacoes, que ganham endereco novo a cada commit,
 * funcionam sem ninguem mexer nesta lista. Um curinga como
 * `https://*.vercel.app` resolveria tambem, e seria pior: passaria a confiar
 * em QUALQUER app hospedado na Vercel, inclusive de terceiros.
 */
const origensConfiaveis = [
  enderecoDoApp,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
]
  .filter((v): v is string => Boolean(v))
  .map((v) => (v.startsWith("http") ? v : `https://${v}`));

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: enderecoDoApp,
  trustedOrigins: [...new Set(origensConfiaveis)],

  database: drizzleAdapter(db, {
    provider: "pg",
    // Mapeamento explicito: nossas tabelas nao seguem os nomes que o adapter
    // procura por convencao (`account` aqui e' provedor de login, nao conta
    // bancaria — a bancaria e' `financial_accounts`).
    schema: {
      user: users,
      session: sessions,
      account: authAccounts,
      verification: verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    // Sem verificacao de e-mail por enquanto: ainda nao ha' servico de envio.
    // Quando entrar, vira `requireEmailVerification: true`.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // renova a sessao no maximo 1x por dia
    cookieCache: {
      // Evita ir ao banco a cada request so' pra ler a sessao.
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Todo usuario novo precisa de um espaco financeiro; sem isso ele
          // cai numa conta que nao consegue guardar nada.
          await criarWorkspaceInicial({
            userId: user.id,
            nomeUsuario: user.name,
          });
        },
      },
    },
  },

  // Precisa ser o ultimo plugin: e' ele que persiste o cookie de sessao nas
  // Server Actions e Route Handlers do Next.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
