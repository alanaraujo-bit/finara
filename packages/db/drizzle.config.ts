import { defineConfig } from "drizzle-kit";

// Node 21+ carrega .env sem dependencia externa.
try {
  process.loadEnvFile?.(".env");
} catch {
  // .env ausente e' aceitavel se DATABASE_URL ja' veio do ambiente.
}

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL nao definida em packages/db/.env");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url, ssl: "require" },
  casing: "snake_case",
  verbose: true,
  // strict off: usamos generate+migrate (versionado), nao push interativo.
  strict: false,
});
