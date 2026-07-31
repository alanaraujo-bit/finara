import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { visibilityEnum, workspaces } from "./workspace";

/**
 * Convencao de dinheiro em todo o Finara: valores sao inteiros em CENTAVOS
 * (bigint). Nada de float — 0.1 + 0.2 nao pode virar saldo errado.
 * A formatacao para "R$ 1.234,56" acontece so' na borda da UI.
 *
 * Convencao de data: colunas `date` guardam 'YYYY-MM-DD' como string, sem fuso.
 * Um gasto do dia 31 tem que aparecer no dia 31 no calendario, sempre.
 */

export const accountTypeEnum = pgEnum("account_type", [
  "checking", // conta corrente
  "savings", // poupanca
  "cash", // dinheiro vivo
  "investment", // investimentos
  "wallet", // carteira digital
  "other",
]);

export const categoryKindEnum = pgEnum("category_kind", ["expense", "income"]);

export const transactionTypeEnum = pgEnum("transaction_type", ["expense", "income", "transfer"]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending", // previsto, ainda nao caiu
  "cleared", // efetivado
  "canceled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "open", // aberta, ainda recebendo lancamentos
  "closed", // fechada, aguardando pagamento
  "paid",
  "partial",
  "overdue",
]);

/** Contas bancarias, carteiras e dinheiro vivo. */
export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // NULL = conta conjunta do casal.
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("shared"),

    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull().default("checking"),
    institution: text("institution"),
    currency: text("currency").notNull().default("BRL"),

    // Saldo de abertura + saldo corrente (materializado para leitura rapida).
    initialBalance: bigint("initial_balance", { mode: "number" }).notNull().default(0),
    currentBalance: bigint("current_balance", { mode: "number" }).notNull().default(0),

    color: text("color").notNull().default("#6366f1"),
    icon: text("icon").notNull().default("Bank"),
    // Conta fora do calculo de patrimonio (ex: conta de terceiro que so' acompanho).
    excludeFromTotals: boolean("exclude_from_totals").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("financial_accounts_ws_idx").on(t.workspaceId),
    index("financial_accounts_owner_idx").on(t.ownerId),
  ],
);

/** Cartoes de credito. O ciclo fecha no `closingDay` e vence no `dueDay`. */
export const creditCards = pgTable(
  "credit_cards",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("shared"),

    name: text("name").notNull(),
    brand: text("brand"), // visa, mastercard, elo...
    lastFourDigits: text("last_four_digits"),
    creditLimit: bigint("credit_limit", { mode: "number" }).notNull().default(0),

    closingDay: integer("closing_day").notNull(), // 1-31
    dueDay: integer("due_day").notNull(), // 1-31

    // Conta de onde sai o pagamento da fatura.
    paymentAccountId: text("payment_account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),

    color: text("color").notNull().default("#8b5cf6"),
    icon: text("icon").notNull().default("CreditCard"),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_cards_ws_idx").on(t.workspaceId)],
);

/** Faturas de cartao, uma por mes de referencia. */
export const cardInvoices = pgTable(
  "card_invoices",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => creditCards.id, { onDelete: "cascade" }),

    // Mes de referencia no formato 'YYYY-MM'.
    referenceMonth: text("reference_month").notNull(),
    closingDate: date("closing_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),

    totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull().default(0),
    status: invoiceStatusEnum("status").notNull().default("open"),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("card_invoices_card_month_uq").on(t.cardId, t.referenceMonth),
    index("card_invoices_ws_idx").on(t.workspaceId),
  ],
);

/** Categorias, com suporte a subcategoria via `parentId`. */
export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    kind: categoryKindEnum("kind").notNull().default("expense"),
    // Auto-referencia: apagar a categoria pai solta as filhas em vez de derrubar.
    parentId: text("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),

    color: text("color").notNull().default("#6366f1"),
    icon: text("icon").notNull().default("Tag"),
    // Teto mensal opcional para essa categoria, em centavos.
    monthlyBudget: bigint("monthly_budget", { mode: "number" }),
    // Categorias criadas pelo sistema no onboarding nao podem ser apagadas.
    isSystem: boolean("is_system").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("categories_ws_idx").on(t.workspaceId),
    index("categories_parent_idx").on(t.parentId),
  ],
);

/**
 * Lancamentos. Tabela central do app — tudo (assinatura, parcela de divida,
 * recebivel, compra no cartao) acaba virando linha aqui.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("cleared"),

    // Sempre positivo. O sinal vem de `type` — evita erro de sinal invertido.
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),

    description: text("description").notNull(),
    notes: text("notes"),

    // Data do fato (o que manda no calendario de gastos).
    date: date("date", { mode: "string" }).notNull(),
    // Competencia: em qual mes esse gasto "pesa". Compra parcelada usa isso.
    competenceDate: date("competence_date", { mode: "string" }),

    // Origem do dinheiro: conta OU cartao (fatura). Nunca os dois.
    accountId: text("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
    cardId: text("card_id").references(() => creditCards.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id").references(() => cardInvoices.id, { onDelete: "set null" }),

    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),

    // Quem gastou. NULL = despesa conjunta.
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("shared"),
    // Rateio no casal: quanto (em pontos percentuais) cabe ao `ownerId`.
    // NULL = sem rateio. 50 = meio a meio.
    splitPercent: integer("split_percent"),

    // Parcelamento: "3/12".
    installmentNumber: integer("installment_number"),
    installmentTotal: integer("installment_total"),
    // Agrupa todas as parcelas de uma mesma compra.
    installmentGroupId: text("installment_group_id"),

    // Liga as duas pontas de uma transferencia entre contas.
    transferPairId: text("transfer_pair_id"),

    tags: jsonb("tags").$type<string[]>().default([]),
    attachmentUrl: text("attachment_url"),

    // Preenchido quando o lancamento veio do Open Finance, nao da mao do usuario.
    externalId: text("external_id"),
    connectionId: text("connection_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Indice principal: quase toda tela filtra por workspace + periodo.
    index("transactions_ws_date_idx").on(t.workspaceId, t.date),
    index("transactions_account_idx").on(t.accountId),
    index("transactions_card_idx").on(t.cardId),
    index("transactions_invoice_idx").on(t.invoiceId),
    index("transactions_category_idx").on(t.categoryId),
    index("transactions_owner_idx").on(t.ownerId),
    index("transactions_installment_group_idx").on(t.installmentGroupId),
    // Barra reimportacao duplicada vinda do Open Finance.
    uniqueIndex("transactions_connection_external_uq").on(t.connectionId, t.externalId),
  ],
);
