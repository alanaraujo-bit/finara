"use server";

import { and, creditCards, db, eq, financialAccounts, sql, transactions } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paraDataLocal } from "@/lib/datas";
import { newId } from "@/lib/id";
import { formatMoney, parseMoney } from "@/lib/money";
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

/**
 * Edita os dados da conta. O saldo NAO entra aqui de proposito — ele e' a
 * soma do que o extrato explica, e sobrescrever o numero direto faria o saldo
 * deixar de bater com os lancamentos sem deixar rastro de por que mudou. Para
 * corrigir saldo existe `ajustarSaldo`, que registra a diferenca.
 */
export async function editarConta(_anterior: EstadoConta, form: FormData): Promise<EstadoConta> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema
    .omit({ saldoInicial: true })
    .extend({ id: z.string().min(1) })
    .safeParse({
      id: form.get("id"),
      nome: form.get("nome"),
      tipo: form.get("tipo"),
      instituicao: form.get("instituicao") || undefined,
      titularidade: form.get("titularidade"),
    });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;

  await db
    .update(financialAccounts)
    .set({
      ownerId: d.titularidade === "conjunta" ? null : usuario.id,
      name: d.nome,
      type: d.tipo,
      institution: d.instituicao ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialAccounts.id, d.id),
        eq(financialAccounts.workspaceId, workspace.workspaceId),
      ),
    );

  revalidatePath("/contas");
  revalidatePath("/lancamentos");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Corrige o saldo criando um lancamento com a DIFERENCA, em vez de
 * sobrescrever o numero.
 *
 * Assim o extrato continua explicando o saldo: aparece uma linha "Ajuste de
 * saldo" de R$ 12,30, e daqui a seis meses ainda da' pra saber por que o
 * numero mudou. Sobrescrever o campo deixaria o saldo divergindo da soma dos
 * lancamentos para sempre, sem nenhuma pista.
 */
export async function ajustarSaldo(contaId: string, saldoReal: string): Promise<EstadoConta> {
  const { workspace } = await exigirSessao();

  const alvo = parseMoney(saldoReal);

  const resultado = await db.transaction(async (tx) => {
    const [conta] = await tx
      .select({ id: financialAccounts.id, saldo: financialAccounts.currentBalance })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, contaId),
          eq(financialAccounts.workspaceId, workspace.workspaceId),
        ),
      )
      .limit(1);

    if (!conta) return { erro: "Conta não encontrada." };

    const diferenca = alvo - conta.saldo;
    if (diferenca === 0) return { erro: "O saldo já é esse. Nada a ajustar." };

    await tx.insert(transactions).values({
      id: newId(),
      workspaceId: workspace.workspaceId,
      // O sinal mora no tipo; o valor guardado é sempre positivo.
      type: diferenca > 0 ? "income" : "expense",
      status: "cleared",
      amount: Math.abs(diferenca),
      description: "Ajuste de saldo",
      notes: `Saldo corrigido de ${formatMoney(conta.saldo)} para ${formatMoney(alvo)}.`,
      date: paraDataLocal(),
      accountId: conta.id,
    });

    await tx
      .update(financialAccounts)
      .set({ currentBalance: alvo, updatedAt: new Date() })
      .where(eq(financialAccounts.id, conta.id));

    return { ok: true as const };
  });

  if (resultado.erro) return resultado;

  revalidatePath("/contas");
  revalidatePath("/lancamentos");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

export async function arquivarConta(contaId: string, arquivar = true): Promise<EstadoConta> {
  const { workspace } = await exigirSessao();

  // O `and` com workspaceId nao e' redundante: sem ele, um id adivinhado
  // deixaria alguem arquivar conta de outro espaco.
  await db
    .update(financialAccounts)
    .set({ isArchived: arquivar, updatedAt: new Date() })
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

/**
 * Exclui a conta — so' quando nada aponta pra ela.
 *
 * As FKs de `transactions.accountId` e `creditCards.paymentAccountId` sao
 * `SET NULL`: apagar uma conta com movimento nao daria erro nenhum, apenas
 * soltaria os lancamentos em silencio, e o extrato passaria a mostrar gastos
 * sem origem. Com historico, o caminho e' arquivar.
 */
export async function excluirConta(contaId: string): Promise<EstadoConta> {
  const { workspace } = await exigirSessao();

  const [{ quantos }] = await db
    .select({ quantos: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, contaId),
        eq(transactions.workspaceId, workspace.workspaceId),
      ),
    );

  if (Number(quantos) > 0) {
    return {
      erro: `Esta conta tem ${quantos} ${Number(quantos) === 1 ? "lançamento" : "lançamentos"}. Arquive em vez de excluir — o extrato antigo precisa continuar fazendo sentido.`,
    };
  }

  const [{ quantos: cartoes }] = await db
    .select({ quantos: sql<number>`count(*)::int` })
    .from(creditCards)
    .where(
      and(
        eq(creditCards.paymentAccountId, contaId),
        eq(creditCards.workspaceId, workspace.workspaceId),
      ),
    );

  if (Number(cartoes) > 0) {
    return {
      erro: "Algum cartão paga a fatura por esta conta. Troque a conta de pagamento do cartão antes de excluir.",
    };
  }

  await db
    .delete(financialAccounts)
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
