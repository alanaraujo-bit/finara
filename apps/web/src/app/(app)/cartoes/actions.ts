"use server";

import { and, cardInvoices, creditCards, db, eq, financialAccounts, sql } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
 * Marca a fatura como paga e, se houver conta de pagamento, debita o valor.
 *
 * O debito e' o passo que a maioria dos apps esquece: sem ele o cartao fica
 * quitado mas o dinheiro nunca "sai" da conta, e o saldo fica inflado.
 */
export async function pagarFatura(faturaId: string): Promise<EstadoCartao> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [fatura] = await tx
      .select({
        id: cardInvoices.id,
        cardId: cardInvoices.cardId,
        status: cardInvoices.status,
        total: sql<number>`coalesce((
          select sum(t.amount) from transactions t
          where t.invoice_id = ${cardInvoices.id} and t.status <> 'canceled'
        ), 0)`,
      })
      .from(cardInvoices)
      .where(
        and(eq(cardInvoices.id, faturaId), eq(cardInvoices.workspaceId, workspace.workspaceId)),
      )
      .limit(1);

    if (!fatura || fatura.status === "paid") return;

    const total = Number(fatura.total);

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
