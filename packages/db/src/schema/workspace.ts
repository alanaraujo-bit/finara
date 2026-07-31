import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * O workspace e' o espaco financeiro compartilhado — a base do modo casal.
 *
 * Toda tabela financeira aponta para um workspace. Dentro dele, cada registro
 * pode ser:
 *   ownerId = NULL   -> conjunto (do casal)
 *   ownerId = <user> -> individual daquela pessoa
 *
 * E a coluna `visibility` decide se o parceiro enxerga o registro individual.
 * Essa combinacao e' o que permite "o que e' meu, o que e' seu, o que e' nosso"
 * sem precisar de dois bancos nem de duplicar lancamento.
 */

export const memberRoleEnum = pgEnum("member_role", ["owner", "partner"]);
export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "revoked", "expired"]);
export const visibilityEnum = pgEnum("visibility", ["shared", "private"]);

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").notNull().default("BRL"),
  locale: text("locale").notNull().default("pt-BR"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("partner"),
    // Apelido curto exibido na UI ("Alan", "Bia") — evita repetir o nome completo.
    displayName: text("display_name"),
    // Cor que identifica a pessoa em graficos e chips de lancamento.
    color: text("color").notNull().default("#6366f1"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("workspace_members_ws_user_uq").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
  ],
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    status: inviteStatusEnum("status").notNull().default("pending"),
    invitedById: text("invited_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workspace_invites_ws_idx").on(t.workspaceId)],
);
