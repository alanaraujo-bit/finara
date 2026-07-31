"use server";

import {
  and,
  db,
  debtInstallments,
  debts,
  eq,
  financialAccounts,
  sql,
  transactions,
} from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mesmoDiaNoMes, paraDataLocal } from "@/lib/datas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { exigirSessao } from "@/lib/session";

/**
 * As perguntas sao as que a pessoa sabe responder de cabeca olhando o boleto:
 * quantas parcelas ao todo, quantas ja' pagou e quanto e' a proxima. Total,
 * quanto ja' foi quitado, quanto falta e a data de cada parcela — passada e
 * futura — sao deduzidos daqui.
 *
 * O caminho antigo pedia o valor TOTAL da divida, que quase ninguem tem na
 * ponta da lingua: exigia abrir o contrato ou multiplicar na mao.
 */
const esquema = z.object({
  nome: z.string().trim().min(2, "Dê um nome à dívida.").max(60),
  credor: z.string().trim().max(60).optional(),
  parcelasTotal: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 parcela.")
    .max(480, "Máximo 480 parcelas."),
  parcelasPagas: z.coerce.number().int().min(0, "Não pode ser negativo.").max(480),
  valorParcela: z.string().min(1, "Informe o valor da parcela."),
  proximoVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  titularidade: z.enum(["conjunto", "meu"]),
});

export type EstadoDivida = { erro?: string; ok?: boolean };

export async function criarDivida(_anterior: EstadoDivida, form: FormData): Promise<EstadoDivida> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    nome: form.get("nome"),
    credor: form.get("credor") || undefined,
    parcelasTotal: form.get("parcelasTotal"),
    parcelasPagas: form.get("parcelasPagas") || "0",
    valorParcela: form.get("valorParcela"),
    proximoVencimento: form.get("proximoVencimento"),
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const parcela = parseMoney(d.valorParcela);

  if (parcela <= 0) return { erro: "O valor da parcela precisa ser maior que zero." };

  if (d.parcelasPagas >= d.parcelasTotal) {
    return {
      erro: "Se já pagou todas as parcelas, não há dívida a acompanhar. Confira quantas faltam.",
    };
  }

  const total = parcela * d.parcelasTotal;
  const pago = parcela * d.parcelasPagas;

  /**
   * A ancora e' o PROXIMO vencimento. As parcelas ja' pagas ficam atras dele
   * (deslocamento negativo) e as futuras a frente. Ancorar aqui, e nao no
   * primeiro vencimento, e' o que dispensa o usuario de lembrar quando a
   * divida comecou.
   */
  const datas = Array.from({ length: d.parcelasTotal }, (_, i) =>
    mesmoDiaNoMes(d.proximoVencimento, i - d.parcelasPagas),
  );

  const dividaId = newId();

  await db.transaction(async (tx) => {
    await tx.insert(debts).values({
      id: dividaId,
      workspaceId: workspace.workspaceId,
      ownerId: d.titularidade === "conjunto" ? null : usuario.id,
      name: d.nome,
      creditor: d.credor ?? null,
      principalAmount: total,
      totalAmount: total,
      paidAmount: pago,
      installmentsTotal: d.parcelasTotal,
      installmentsPaid: d.parcelasPagas,
      startDate: datas[0]!,
      endDate: datas[datas.length - 1] ?? null,
      dueDay: Number(d.proximoVencimento.slice(-2)),
      status: "active",
    });

    await tx.insert(debtInstallments).values(
      datas.map((data, i) => {
        const quitada = i < d.parcelasPagas;
        return {
          id: newId(),
          debtId: dividaId,
          workspaceId: workspace.workspaceId,
          number: i + 1,
          amount: parcela,
          dueDate: data,
          paidAmount: quitada ? parcela : 0,
          status: quitada ? ("paid" as const) : ("pending" as const),
        };
      }),
    );

    /**
     * De proposito, as parcelas ja' pagas NAO viram lancamento.
     *
     * Elas foram pagas antes de a divida existir aqui — inventar despesas
     * retroativas encheria o extrato e o calendario de gastos que o usuario
     * nunca registrou, e estragaria a comparacao entre meses. O historico
     * fica registrado na divida; o fluxo de caixa comeca da proxima parcela.
     */
  });

  revalidatePath("/dividas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Marca uma parcela como paga: cria o lancamento, debita a conta se houver,
 * e atualiza o acumulado da divida. Tudo numa transacao.
 */
export async function pagarParcela(
  parcelaId: string,
  contaId?: string,
): Promise<EstadoDivida> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [parcela] = await tx
      .select({
        id: debtInstallments.id,
        debtId: debtInstallments.debtId,
        valor: debtInstallments.amount,
        status: debtInstallments.status,
        vencimento: debtInstallments.dueDate,
        nome: debts.name,
      })
      .from(debtInstallments)
      .innerJoin(debts, eq(debts.id, debtInstallments.debtId))
      .where(
        and(
          eq(debtInstallments.id, parcelaId),
          eq(debtInstallments.workspaceId, workspace.workspaceId),
        ),
      )
      .limit(1);

    if (!parcela || parcela.status === "paid") return;

    const lancamentoId = newId();

    await tx.insert(transactions).values({
      id: lancamentoId,
      workspaceId: workspace.workspaceId,
      type: "expense",
      status: "cleared",
      amount: parcela.valor,
      description: `Parcela · ${parcela.nome}`,
      date: paraDataLocal(),
      accountId: contaId || null,
    });

    await tx
      .update(debtInstallments)
      .set({
        status: "paid",
        paidAmount: parcela.valor,
        paidAt: new Date(),
        transactionId: lancamentoId,
        updatedAt: new Date(),
      })
      .where(eq(debtInstallments.id, parcela.id));

    await tx
      .update(debts)
      .set({
        paidAmount: sql`${debts.paidAmount} + ${parcela.valor}`,
        installmentsPaid: sql`${debts.installmentsPaid} + 1`,
        // Quitou a ultima parcela: a divida fecha sozinha.
        status: sql`case when ${debts.installmentsPaid} + 1 >= ${debts.installmentsTotal} then 'paid' else ${debts.status} end`,
        updatedAt: new Date(),
      })
      .where(eq(debts.id, parcela.debtId));

    if (contaId) {
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} - ${parcela.valor}`,
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

  revalidatePath("/dividas");
  revalidatePath("/lancamentos");
  revalidatePath("/");
  return { ok: true };
}
