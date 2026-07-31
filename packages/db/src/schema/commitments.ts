import {
  bigint,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { visibilityEnum, workspaces } from "./workspace";
import { categories, creditCards, financialAccounts, transactions } from "./finance";

/**
 * Compromissos financeiros que se estendem no tempo: assinaturas, dividas
 * (dinheiro que devo) e recebiveis (dinheiro que tenho a receber).
 *
 * Todos geram lancamentos em `transactions` quando efetivados — aqui fica
 * so' o "contrato", la' fica o fato consumado.
 */

export const billingCycleEnum = pgEnum("billing_cycle", [
  "weekly",
  "biweekly",
  "monthly",
  "bimonthly",
  "quarterly",
  "semiannual",
  "yearly",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trial",
  "paused",
  "canceled",
]);

export const debtStatusEnum = pgEnum("debt_status", ["active", "paid", "renegotiated", "defaulted"]);

export const settlementStatusEnum = pgEnum("settlement_status", [
  "pending",
  "paid",
  "overdue",
  "partial",
  "canceled",
]);

export const receivableStatusEnum = pgEnum("receivable_status", [
  "pending",
  "received",
  "overdue",
  "partial",
  "canceled",
]);

/** Assinaturas e servicos recorrentes (streaming, academia, SaaS...). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("shared"),

    name: text("name").notNull(),
    description: text("description"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),

    cycle: billingCycleEnum("cycle").notNull().default("monthly"),
    // Dia do ciclo em que cobra (1-31 no mensal, 1-7 no semanal).
    billingDay: integer("billing_day"),
    startedAt: date("started_at", { mode: "string" }).notNull(),
    nextChargeAt: date("next_charge_at", { mode: "string" }),
    trialEndsAt: date("trial_ends_at", { mode: "string" }),
    canceledAt: date("canceled_at", { mode: "string" }),

    status: subscriptionStatusEnum("status").notNull().default("active"),

    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    accountId: text("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
    cardId: text("card_id").references(() => creditCards.id, { onDelete: "set null" }),

    color: text("color").notNull().default("#0ea5e9"),
    icon: text("icon").notNull().default("Repeat"),
    logoUrl: text("logo_url"),

    // Avisar N dias antes da proxima cobranca.
    reminderDaysBefore: integer("reminder_days_before").notNull().default(2),
    // Lanca sozinho na data, sem precisar confirmar.
    autoCreateTransaction: boolean("auto_create_transaction").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_ws_idx").on(t.workspaceId),
    index("subscriptions_next_charge_idx").on(t.nextChargeAt),
  ],
);

/** Dividas: financiamentos, emprestimos, parcelamentos, dinheiro devido a alguem. */
export const debts = pgTable(
  "debts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("shared"),

    name: text("name").notNull(),
    creditor: text("creditor"), // pra quem devo
    description: text("description"),

    // Valor original contratado.
    principalAmount: bigint("principal_amount", { mode: "number" }).notNull(),
    // Total a pagar ja' com juros.
    totalAmount: bigint("total_amount", { mode: "number" }).notNull(),
    // Quanto ja' foi quitado (materializado).
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),

    // Taxa de juros ao mes, em porcentagem. numeric evita erro de arredondamento.
    interestRate: numeric("interest_rate", { precision: 8, scale: 4 }),

    installmentsTotal: integer("installments_total").notNull().default(1),
    installmentsPaid: integer("installments_paid").notNull().default(0),

    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    dueDay: integer("due_day"),

    status: debtStatusEnum("status").notNull().default("active"),

    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    accountId: text("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),

    color: text("color").notNull().default("#f43f5e"),
    icon: text("icon").notNull().default("TrendDown"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("debts_ws_idx").on(t.workspaceId), index("debts_status_idx").on(t.status)],
);

/** Cada parcela de uma divida. E' o que alimenta o calendario de vencimentos. */
export const debtInstallments = pgTable(
  "debt_installments",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id")
      .notNull()
      .references(() => debts.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    number: integer("number").notNull(), // 1..installmentsTotal
    amount: bigint("amount", { mode: "number" }).notNull(),
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull().default(0),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    status: settlementStatusEnum("status").notNull().default("pending"),

    // Lancamento gerado quando a parcela foi paga.
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("debt_installments_debt_idx").on(t.debtId),
    index("debt_installments_due_idx").on(t.workspaceId, t.dueDate),
  ],
);

/** Dinheiro a receber: emprestei, vendi fiado, reembolso, freela a receber. */
export const receivables = pgTable(
  "receivables",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("shared"),

    name: text("name").notNull(),
    debtor: text("debtor"), // quem me deve
    description: text("description"),

    amount: bigint("amount", { mode: "number" }).notNull(),
    receivedAmount: bigint("received_amount", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("BRL"),

    dueDate: date("due_date", { mode: "string" }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    status: receivableStatusEnum("status").notNull().default("pending"),

    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    accountId: text("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),

    color: text("color").notNull().default("#10b981"),
    icon: text("icon").notNull().default("TrendUp"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("receivables_ws_idx").on(t.workspaceId),
    index("receivables_due_idx").on(t.workspaceId, t.dueDate),
  ],
);

/** Orcamento mensal por categoria. Um registro por categoria/mes. */
export const budgets = pgTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    // 'YYYY-MM'
    referenceMonth: text("reference_month").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("budgets_ws_month_idx").on(t.workspaceId, t.referenceMonth)],
);

/** Metas de economia (reserva de emergencia, viagem, troca de carro...). */
export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("shared"),

    name: text("name").notNull(),
    description: text("description"),
    targetAmount: bigint("target_amount", { mode: "number" }).notNull(),
    savedAmount: bigint("saved_amount", { mode: "number" }).notNull().default(0),
    targetDate: date("target_date", { mode: "string" }),
    accountId: text("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),

    color: text("color").notNull().default("#f59e0b"),
    icon: text("icon").notNull().default("Target"),
    isArchived: boolean("is_archived").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_ws_idx").on(t.workspaceId)],
);
