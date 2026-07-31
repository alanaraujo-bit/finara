"use server";

import {
  and,
  cardInvoices,
  creditCards,
  db,
  eq,
  financialAccounts,
  sql,
  transactions,
} from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paraDataLocal } from "@/lib/datas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { exigirSessao } from "@/lib/session";

const esquema = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao cartão.").max(60),
  bandeira: z.string().trim().max(30).optional(),
  final: z.string().trim().regex(/^\d{0,4}$/, "Use até 4 dígitos.").optional(),
  limite: z.string(),
  diaFechamento: z.coerce.number().int().min(1, "Dia entre 1 e 31.").max(31, "Dia entre 1 e 31."),
  diaVencimento: z.coerce.number().int().min(1, "Dia entre 1 e 31.").max(31, "Dia entre 1 e 31."),
  contaPagamentoId: z.string().optional(),
  titularidade: z.enum(["conjunto", "meu"]),
});

export type EstadoCartao = { erro?: string; ok?: boolean };

export async function criarCartao(_anterior: EstadoCartao, form: FormData): Promise<EstadoCartao> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    nome: form.get("nome"),
    bandeira: form.get("bandeira") || undefined,
    final: form.get("final") || undefined,
    limite: form.get("limite") ?? "0",
    diaFechamento: form.get("diaFechamento"),
    diaVencimento: form.get("diaVencimento"),
    contaPagamentoId: form.get("contaPagamentoId") || undefined,
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;

  await db.insert(creditCards).values({
    id: newId(),
    workspaceId: workspace.workspaceId,
    ownerId: d.titularidade === "conjunto" ? null : usuario.id,
    name: d.nome,
    brand: d.bandeira ?? null,
    lastFourDigits: d.final || null,
    creditLimit: parseMoney(d.limite),
    closingDay: d.diaFechamento,
    dueDay: d.diaVencimento,
    paymentAccountId: d.contaPagamentoId || null,
  });

  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Edita o cartao.
 *
 * Dia de fechamento e vencimento sao os campos delicados: os lancamentos ja'
 * existentes foram distribuidos em faturas pelo ciclo ANTIGO e continuam onde
 * estao — mudar os dias vale da proxima compra em diante. Refazer o passado
 * significaria mover lancamentos entre faturas (inclusive faturas ja' pagas),
 * o que muda numero que a pessoa ja' conferiu. Por isso a troca so' passa
 * enquanto nao ha' fatura paga; depois disso o caminho honesto e' criar um
 * cartao novo.
 */
export async function editarCartao(_anterior: EstadoCartao, form: FormData): Promise<EstadoCartao> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.extend({ id: z.string().min(1) }).safeParse({
    id: form.get("id"),
    nome: form.get("nome"),
    bandeira: form.get("bandeira") || undefined,
    final: form.get("final") || undefined,
    limite: form.get("limite") ?? "0",
    diaFechamento: form.get("diaFechamento"),
    diaVencimento: form.get("diaVencimento"),
    contaPagamentoId: form.get("contaPagamentoId") || undefined,
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;

  const [atual] = await db
    .select({ fechamento: creditCards.closingDay, vencimento: creditCards.dueDay })
    .from(creditCards)
    .where(and(eq(creditCards.id, d.id), eq(creditCards.workspaceId, workspace.workspaceId)))
    .limit(1);

  if (!atual) return { erro: "Cartão não encontrado." };

  const mudouCiclo = atual.fechamento !== d.diaFechamento || atual.vencimento !== d.diaVencimento;

  if (mudouCiclo) {
    const [{ pagas }] = await db
      .select({ pagas: sql<number>`count(*)::int` })
      .from(cardInvoices)
      .where(and(eq(cardInvoices.cardId, d.id), eq(cardInvoices.status, "paid")));

    if (Number(pagas) > 0) {
      return {
        erro: "Este cartão já tem fatura paga. Mudar o dia de fechamento agora remontaria faturas que você já conferiu — mantenha os dias e crie um cartão novo se o banco mudou o ciclo.",
      };
    }
  }

  await db
    .update(creditCards)
    .set({
      ownerId: d.titularidade === "conjunto" ? null : usuario.id,
      name: d.nome,
      brand: d.bandeira ?? null,
      lastFourDigits: d.final || null,
      creditLimit: parseMoney(d.limite),
      closingDay: d.diaFechamento,
      dueDay: d.diaVencimento,
      paymentAccountId: d.contaPagamentoId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(creditCards.id, d.id), eq(creditCards.workspaceId, workspace.workspaceId)));

  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

export async function arquivarCartao(cartaoId: string, arquivar = true): Promise<EstadoCartao> {
  const { workspace } = await exigirSessao();

  await db
    .update(creditCards)
    .set({ isArchived: arquivar, updatedAt: new Date() })
    .where(and(eq(creditCards.id, cartaoId), eq(creditCards.workspaceId, workspace.workspaceId)));

  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Exclui o cartao — so' quando nenhuma compra passou por ele.
 *
 * `transactions.cardId` e' `SET NULL`: apagar um cartao com movimento nao
 * daria erro, so' soltaria as compras em silencio, e elas virariam gastos sem
 * origem no extrato.
 */
export async function excluirCartao(cartaoId: string): Promise<EstadoCartao> {
  const { workspace } = await exigirSessao();

  const [{ quantos }] = await db
    .select({ quantos: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(eq(transactions.cardId, cartaoId), eq(transactions.workspaceId, workspace.workspaceId)),
    );

  if (Number(quantos) > 0) {
    return {
      erro: `Este cartão tem ${quantos} ${Number(quantos) === 1 ? "compra" : "compras"} no histórico. Arquive em vez de excluir.`,
    };
  }

  await db.transaction(async (tx) => {
    // As faturas vazias vao junto; sem compras, elas nao explicam nada.
    await tx
      .delete(cardInvoices)
      .where(
        and(
          eq(cardInvoices.cardId, cartaoId),
          eq(cardInvoices.workspaceId, workspace.workspaceId),
        ),
      );
    await tx
      .delete(creditCards)
      .where(and(eq(creditCards.id, cartaoId), eq(creditCards.workspaceId, workspace.workspaceId)));
  });

  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Desfaz o pagamento da fatura: devolve o valor a' conta e reabre a fatura.
 *
 * Espelho de `pagarFatura`. E' o passo que destrava editar um lancamento que
 * caiu numa fatura ja' quitada — sem isto, um erro de digitacao numa compra
 * de tres meses atras ficaria impossivel de corrigir.
 *
 * O estorno usa `paidAmount`, o valor que de fato saiu da conta, e nao o
 * total recalculado agora: se algum lancamento mudou depois do pagamento, e'
 * o valor pago que precisa voltar, senao o saldo nao fecha.
 */
export async function desfazerPagamentoFatura(faturaId: string): Promise<EstadoCartao> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [fatura] = await tx
      .select({
        id: cardInvoices.id,
        cardId: cardInvoices.cardId,
        status: cardInvoices.status,
        pago: cardInvoices.paidAmount,
        fechamento: cardInvoices.closingDate,
      })
      .from(cardInvoices)
      .where(
        and(eq(cardInvoices.id, faturaId), eq(cardInvoices.workspaceId, workspace.workspaceId)),
      )
      .limit(1);

    if (!fatura || fatura.status !== "paid") return;

    const [cartao] = await tx
      .select({ contaId: creditCards.paymentAccountId })
      .from(creditCards)
      .where(eq(creditCards.id, fatura.cardId))
      .limit(1);

    if (cartao?.contaId && fatura.pago > 0) {
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} + ${fatura.pago}`,
          updatedAt: new Date(),
        })
        .where(eq(financialAccounts.id, cartao.contaId));
    }

    // Fatura cujo ciclo ja' fechou volta para "closed", nao para "open":
    // "open" diria que ela ainda recebe compras novas, o que nao e' verdade.
    const jaFechou = fatura.fechamento <= paraDataLocal();

    await tx
      .update(cardInvoices)
      .set({
        status: jaFechou ? "closed" : "open",
        paidAmount: 0,
        paidAt: null,
        updatedAt: new Date(),
      })
      .where(eq(cardInvoices.id, fatura.id));
  });

  revalidatePath("/cartoes");
  revalidatePath("/contas");
  revalidatePath("/lancamentos");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Marca a fatura como paga e, se houver conta de pagamento, debita o valor.
 *
 * O debito e' o passo que a maioria dos apps esquece: sem ele o cartao fica
 * quitado mas o dinheiro nunca "sai" da conta, e o saldo fica inflado.
 */
export async function pagarFatura(faturaId: string): Promise<EstadoCartao> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [fatura] = await tx
      .select({ id: cardInvoices.id, cardId: cardInvoices.cardId, status: cardInvoices.status })
      .from(cardInvoices)
      .where(
        and(eq(cardInvoices.id, faturaId), eq(cardInvoices.workspaceId, workspace.workspaceId)),
      )
      .limit(1);

    if (!fatura || fatura.status === "paid") return;

    /**
     * Consulta separada, de proposito — nao um subquery correlacionado
     * comparando `t.invoice_id` a uma coluna solta `id` interpolada. Esse
     * padrao tinha um bug real: dentro do subquery, `id` sem qualificar a
     * tabela resolve pro escopo mais interno (a propria `transactions`), nao
     * pro `card_invoices` de fora. O total saia sempre zero, e pagar a
     * fatura gravava `totalAmount: 0` — dinheiro incorreto num registro que
     * devia ficar historico. Ver o mesmo bug em `queries/cartoes.ts`.
     */
    const [{ total: totalBruto }] = await tx
      .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
      .from(transactions)
      .where(and(eq(transactions.invoiceId, fatura.id), sql`${transactions.status} <> 'canceled'`));

    const total = Number(totalBruto);

    await tx
      .update(cardInvoices)
      .set({
        status: "paid",
        paidAmount: total,
        totalAmount: total,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(cardInvoices.id, fatura.id));

    const [cartao] = await tx
      .select({ contaId: creditCards.paymentAccountId })
      .from(creditCards)
      .where(eq(creditCards.id, fatura.cardId))
      .limit(1);

    if (cartao?.contaId && total > 0) {
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} - ${total}`,
          updatedAt: new Date(),
        })
        .where(eq(financialAccounts.id, cartao.contaId));
    }
  });

  revalidatePath("/cartoes");
  revalidatePath("/");
  return { ok: true };
}
