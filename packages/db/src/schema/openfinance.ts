import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { workspaces } from "./workspace";
import { creditCards, financialAccounts } from "./finance";

/**
 * Integracao com Open Finance. Ainda nao esta' plugada em nenhum provedor —
 * o app funciona 100% no manual. Estas tabelas existem desde ja' para que
 * ligar Pluggy/Belvo depois seja configuracao, e nao migration de dado vivo.
 *
 * IMPORTANTE: nenhum segredo de banco entra aqui em texto puro. O provedor
 * guarda as credenciais; nos guardamos so' o identificador do vinculo.
 */

export const providerEnum = pgEnum("of_provider", ["pluggy", "belvo", "manual"]);

export const connectionStatusEnum = pgEnum("of_connection_status", [
  "pending", // aguardando o usuario concluir o consentimento
  "active",
  "needs_action", // MFA ou re-login exigido pelo banco
  "consent_expired",
  "error",
  "disconnected",
]);

export const syncStatusEnum = pgEnum("of_sync_status", ["running", "success", "partial", "failed"]);

/** Um vinculo com uma instituicao financeira. */
export const openFinanceConnections = pgTable(
  "of_connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Quem autorizou o consentimento — no modo casal, importa saber.
    connectedById: text("connected_by_id").references(() => users.id, { onDelete: "set null" }),

    provider: providerEnum("provider").notNull().default("pluggy"),
    // Id do item/link no provedor. Nao e' credencial, e' referencia.
    externalItemId: text("external_item_id"),

    institutionName: text("institution_name").notNull(),
    institutionLogoUrl: text("institution_logo_url"),

    status: connectionStatusEnum("status").notNull().default("pending"),
    statusDetail: text("status_detail"),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    consentExpiresAt: timestamp("consent_expires_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("of_connections_ws_idx").on(t.workspaceId)],
);

/**
 * Liga uma conta/cartao do provedor a' conta/cartao do Finara.
 * Sem isso nao da' pra saber onde jogar a transacao sincronizada.
 */
export const openFinanceLinks = pgTable(
  "of_links",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => openFinanceConnections.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    externalAccountId: text("external_account_id").notNull(),
    externalAccountName: text("external_account_name"),

    // Aponta para um dos dois, nunca os dois.
    financialAccountId: text("financial_account_id").references(() => financialAccounts.id, {
      onDelete: "cascade",
    }),
    creditCardId: text("credit_card_id").references(() => creditCards.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("of_links_connection_idx").on(t.connectionId)],
);

/** Historico de sincronizacoes, pra depurar import que veio torto. */
export const openFinanceSyncRuns = pgTable(
  "of_sync_runs",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => openFinanceConnections.id, { onDelete: "cascade" }),

    status: syncStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    transactionsImported: jsonb("transactions_imported").$type<{
      created: number;
      updated: number;
      skipped: number;
    }>(),
    errorMessage: text("error_message"),
  },
  (t) => [index("of_sync_runs_connection_idx").on(t.connectionId)],
);
