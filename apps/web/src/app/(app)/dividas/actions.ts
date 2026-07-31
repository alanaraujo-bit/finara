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
import { paraDataLocal } from "@/lib/datas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { exigirSessao } from "@/lib/session";

const esquema = z.object({
  nome: z.string().trim().min(2, "Dê um nome à dívida.").max(60),
  credor: z.string().trim().max(60).optional(),
  total: z.string().min(1, "Informe o valor total."),
  parcelas: z.coerce.number().int().min(1, "Mínimo 1 parcela.").max(480, "Máximo 480 parcelas."),
  primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  titularidade: z.enum(["conjunto", "meu"]),
});

export type EstadoDivida = { erro?: string; ok?: boolean };

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Gera as datas de vencimento das parcelas, uma por mes.
 * O dia e' ancorado no primeiro vencimento e encolhe em meses curtos —
 * parcela do dia 31 vence dia 28 em fevereiro, nao dia 3 de marco.
 */
function datasDasParcelas(primeiro: string, quantidade: number): string[] {
  const [ano0, mes0, dia0] = primeiro.split("-").map(Number) as [number, number, number];
  const datas: string[] = [];

  for (let i = 0; i < quantidade; i++) {
    const total = mes0 - 1 + i;
    const ano = ano0 + Math.floor(total / 12);
    const mes = (total % 12) + 1;
    const dia = Math.min(dia0, ultimoDiaDoMes(ano, mes));
    datas.push(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }

  return datas;
}

export async function criarDivida(_anterior: EstadoDivida, form: FormData): Promise<EstadoDivida> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    nome: form.get("nome"),
    credor: form.get("credor") || undefined,
    total: form.get("total"),
    parcelas: form.get("parcelas"),
    primeiroVencimento: form.get("primeiroVencimento"),
    titularidade: form.get("titularidade"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const total = parseMoney(d.total);

  if (total <= 0) return { erro: "O valor total precisa ser maior que zero." };

  // Divisao em centavos: o resto vai para a ULTIMA parcela, senao a soma das
  // parcelas nao bate com o total e sobra centavo perdido.
  const base = Math.floor(total / d.parcelas);
  const resto = total - base * d.parcelas;

  const dividaId = newId();
  const datas = datasDasParcelas(d.primeiroVencimento, d.parcelas);

  await db.transaction(async (tx) => {
    await tx.insert(debts).values({
      id: dividaId,
      workspaceId: workspace.workspaceId,
      ownerId: d.titularidade === "conjunto" ? null : usuario.id,
      name: d.nome,
      creditor: d.credor ?? null,
      principalAmount: total,
      totalAmount: total,
      installmentsTotal: d.parcelas,
      startDate: d.primeiroVencimento,
      endDate: datas[datas.length - 1] ?? null,
      dueDay: Number(d.primeiroVencimento.slice(-2)),
      status: "active",
    });

    await tx.insert(debtInstallments).values(
      datas.map((data, i) => ({
        id: newId(),
        debtId: dividaId,
        workspaceId: workspace.workspaceId,
        number: i + 1,
        amount: i === datas.length - 1 ? base + resto : base,
        dueDate: data,
        status: "pending" as const,
      })),
    );
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
