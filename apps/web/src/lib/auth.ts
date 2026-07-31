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

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

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
