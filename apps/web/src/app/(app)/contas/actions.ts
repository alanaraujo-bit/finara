"use server";

import { and, db, eq, financialAccounts } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { exigirSessao } from "@/lib/session";

const esquema = z.object({
  nome: z.string().trim().min(2, "Dê um nome à conta.").max(60),
  tipo: z.enum(["checking", "savings", "cash", "investment", "wallet", "other"]),
  instituicao: z.string().trim().max(60).optional(),
  saldoInicial: z.string(),
  // "conjunta" = do casal (ownerId nulo); "minha" = individual.
  titularidade: z.enum(["conjunta", "minha"]),
});

export type EstadoConta = { erro?: string; ok?: boolean };

export async function criarConta(_anterior: EstadoConta, form: FormData): Promise<EstadoConta> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    nome: form.get("nome"),
    tipo: form.get("tipo"),
    instituicao: form.get("instituicao") || undefined,
    saldoInicial: form.get("saldoInicial") ?? "0",
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { nome, tipo, instituicao, saldoInicial, titularidade } = parsed.data;
  const saldo = parseMoney(saldoInicial);

  await db.insert(financialAccounts).values({
    id: newId(),
    workspaceId: workspace.workspaceId,
    // NULL = conta conjunta do casal. Ver o schema de workspace.
    ownerId: titularidade === "conjunta" ? null : usuario.id,
    name: nome,
    type: tipo,
    institution: instituicao ?? null,
    // O saldo inicial ja' e' o saldo corrente: nao ha' lancamento anterior.
    initialBalance: saldo,
    currentBalance: saldo,
  });

  revalidatePath("/contas");
  revalidatePath("/");
  return { ok: true };
}

export async function arquivarConta(contaId: string): Promise<EstadoConta> {
  const { workspace } = await exigirSessao();

  // O `and` com workspaceId nao e' redundante: sem ele, um id adivinhado
  // deixaria alguem arquivar conta de outro espaco.
  await db
    .update(financialAccounts)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(
      and(
        eq(financialAccounts.id, contaId),
        eq(financialAccounts.workspaceId, workspace.workspaceId),
      ),
    );

  revalidatePath("/contas");
  revalidatePath("/");
  return { ok: true };
}
