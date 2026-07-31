import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export * from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL nao definida. Copie .env.example para apps/web/.env.local e preencha com a URL publica do Postgres no Railway.",
  );
}

/**
 * O Postgres vive no Railway e e' acessado pelo proxy publico, entao TLS e'
 * obrigatorio. Em serverless (Vercel) cada invocacao levanta seu proprio
 * processo, por isso o pool fica pequeno e o prepare desligado — statement
 * preparado nao sobrevive entre invocacoes e so' custa round-trip.
 */
const isServerless = Boolean(process.env.VERCEL);

const globalForDb = globalThis as unknown as {
  __finaraClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__finaraClient ??
  postgres(connectionString, {
    ssl: "require",
    max: isServerless ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });

// Em dev o hot reload recria o modulo a cada save; sem isso o Railway
// acumularia conexao ate' estourar o limite.
if (process.env.NODE_ENV !== "production") {
  globalForDb.__finaraClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
export { schema };
