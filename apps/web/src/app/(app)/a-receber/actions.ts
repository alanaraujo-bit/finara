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
 * Edita um recebivel que ainda nao caiu.
 *
 * Depois de recebido nao da' pra mexer por aqui: o recebimento gerou um
 * lancamento no extrato e creditou uma conta. Mudar o valor aqui deixaria o
 * recebivel dizendo R$ 500 e o extrato dizendo R$ 300, sem ninguem perceber.
 * O caminho e' desfazer o recebimento, corrigir, e receber de novo.
 */
export async function editarRecebivel(
  _anterior: EstadoReceber,
  form: FormData,
): Promise<EstadoReceber> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.extend({ id: z.string().min(1) }).safeParse({
    id: form.get("id"),
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

  const [atual] = await db
    .select({ status: receivables.status })
    .from(receivables)
    .where(and(eq(receivables.id, d.id), eq(receivables.workspaceId, workspace.workspaceId)))
    .limit(1);

  if (!atual) return { erro: "Recebível não encontrado." };
  if (atual.status === "received") {
    return {
      erro: "Este recebível já entrou. Desfaça o recebimento para poder corrigir os dados.",
    };
  }

  await db
    .update(receivables)
    .set({
      ownerId: d.titularidade === "conjunto" ? null : usuario.id,
      name: d.nome,
      debtor: d.devedor ?? null,
      amount: centavos,
      dueDate: d.vencimento ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(receivables.id, d.id), eq(receivables.workspaceId, workspace.workspaceId)));

  revalidatePath("/a-receber");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Exclui um recebivel. Se ja' foi recebido, o caminho e' desfazer primeiro —
 * apagar direto deixaria o lancamento orfao no extrato e o saldo inflado.
 */
export async function excluirRecebivel(id: string): Promise<EstadoReceber> {
  const { workspace } = await exigirSessao();

  const [atual] = await db
    .select({ status: receivables.status })
    .from(receivables)
    .where(and(eq(receivables.id, id), eq(receivables.workspaceId, workspace.workspaceId)))
    .limit(1);

  if (!atual) return { erro: "Recebível não encontrado." };
  if (atual.status === "received") {
    return {
      erro: "Este recebível já entrou e virou lançamento. Desfaça o recebimento antes de excluir.",
    };
  }

  await db
    .delete(receivables)
    .where(and(eq(receivables.id, id), eq(receivables.workspaceId, workspace.workspaceId)));

  revalidatePath("/a-receber");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Desfaz o recebimento: apaga o lancamento que ele gerou, tira o valor de
 * volta da conta e devolve o recebivel para "pendente".
 *
 * Espelho exato de `receber` — todo passo dado la' e' desfeito aqui, na mesma
 * transacao. E' isto que permite editar um recebivel ja' recebido sem
 * nenhuma tela do app ficar afirmando um numero que outra desmente.
 */
export async function desfazerRecebimento(id: string): Promise<EstadoReceber> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [item] = await tx
      .select({
        id: receivables.id,
        status: receivables.status,
        lancamentoId: receivables.transactionId,
      })
      .from(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.workspaceId, workspace.workspaceId)))
      .limit(1);

    if (!item || item.status !== "received") return;

    if (item.lancamentoId) {
      const [lancamento] = await tx
        .select({
          id: transactions.id,
          valor: transactions.amount,
          contaId: transactions.accountId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.id, item.lancamentoId),
            eq(transactions.workspaceId, workspace.workspaceId),
          ),
        )
        .limit(1);

      if (lancamento) {
        await tx.delete(transactions).where(eq(transactions.id, lancamento.id));

        if (lancamento.contaId) {
          // Era entrada: tirar de volta.
          await tx
            .update(financialAccounts)
            .set({
              currentBalance: sql`${financialAccounts.currentBalance} - ${lancamento.valor}`,
              updatedAt: new Date(),
            })
            .where(eq(financialAccounts.id, lancamento.contaId));
        }
      }
    }

    await tx
      .update(receivables)
      .set({
        status: "pending",
        receivedAmount: 0,
        receivedAt: null,
        transactionId: null,
        updatedAt: new Date(),
      })
      .where(eq(receivables.id, item.id));
  });

  revalidatePath("/a-receber");
  revalidatePath("/lancamentos");
  revalidatePath("/contas");
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
