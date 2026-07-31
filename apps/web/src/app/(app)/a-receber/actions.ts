"use server";

import { and, db, eq, financialAccounts, receivables, sql, transactions } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paraDataLocal } from "@/lib/datas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { exigirSessao } from "@/lib/session";

const esquema = z.object({
  nome: z.string().trim().min(2, "Descreva o que você tem a receber.").max(60),
  devedor: z.string().trim().max(60).optional(),
  valor: z.string().min(1, "Informe o valor."),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").optional(),
  titularidade: z.enum(["conjunto", "meu"]),
});

export type EstadoReceber = { erro?: string; ok?: boolean };

export async function criarRecebivel(
  _anterior: EstadoReceber,
  form: FormData,
): Promise<EstadoReceber> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    nome: form.get("nome"),
    devedor: form.get("devedor") || undefined,
    valor: form.get("valor"),
    vencimento: form.get("vencimento") || undefined,
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const centavos = parseMoney(d.valor);

  if (centavos <= 0) return { erro: "O valor precisa ser maior que zero." };

  await db.insert(receivables).values({
    id: newId(),
    workspaceId: workspace.workspaceId,
    ownerId: d.titularidade === "conjunto" ? null : usuario.id,
    name: d.nome,
    debtor: d.devedor ?? null,
    amount: centavos,
    dueDate: d.vencimento ?? null,
    status: "pending",
  });

  revalidatePath("/a-receber");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Marca como recebido: cria a entrada no extrato e credita a conta.
 * Sem esse passo, o dinheiro "chega" mas o saldo nunca sobe.
 */
export async function receber(id: string, contaId?: string): Promise<EstadoReceber> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [item] = await tx
      .select({
        id: receivables.id,
        nome: receivables.name,
        valor: receivables.amount,
        status: receivables.status,
      })
      .from(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.workspaceId, workspace.workspaceId)))
      .limit(1);

    if (!item || item.status === "received") return;

    const lancamentoId = newId();

    await tx.insert(transactions).values({
      id: lancamentoId,
      workspaceId: workspace.workspaceId,
      type: "income",
      status: "cleared",
      amount: item.valor,
      description: item.nome,
      date: paraDataLocal(),
      accountId: contaId || null,
    });

    await tx
      .update(receivables)
      .set({
        status: "received",
        receivedAmount: item.valor,
        receivedAt: new Date(),
        transactionId: lancamentoId,
        updatedAt: new Date(),
      })
      .where(eq(receivables.id, item.id));

    if (contaId) {
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} + ${item.valor}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(financialAccounts.id, contaId),
            eq(financialAccounts.workspaceId, workspace.workspaceId),
          ),
        );
    }
  });

  revalidatePath("/a-receber");
  revalidatePath("/lancamentos");
  revalidatePath("/");
  return { ok: true };
}
