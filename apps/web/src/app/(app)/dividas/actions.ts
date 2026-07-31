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
 * Edita a divida.
 *
 * Nome, credor e titularidade mudam sempre — sao rotulo, nao dinheiro.
 *
 * Valor da parcela, quantidade e proximo vencimento reescrevem o cronograma
 * inteiro, entao so' valem para as parcelas AINDA NAO PAGAS. As pagas ficam
 * como estao: elas ja' viraram lancamento no extrato e mexer nelas por aqui
 * deixaria a divida e o extrato contando historias diferentes. Para corrigir
 * uma parcela paga, o caminho e' desfazer o pagamento dela primeiro.
 */
export async function editarDivida(
  _anterior: EstadoDivida,
  form: FormData,
): Promise<EstadoDivida> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema
    .omit({ parcelasPagas: true })
    .extend({ id: z.string().min(1) })
    .safeParse({
      id: form.get("id"),
      nome: form.get("nome"),
      credor: form.get("credor") || undefined,
      parcelasTotal: form.get("parcelasTotal"),
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

  try {
    await db.transaction(async (tx) => {
      const [divida] = await tx
        .select({
          id: debts.id,
          pagas: debts.installmentsPaid,
          valorPago: debts.paidAmount,
        })
        .from(debts)
        .where(and(eq(debts.id, d.id), eq(debts.workspaceId, workspace.workspaceId)))
        .limit(1);

      if (!divida) throw new ErroDeRegra("Dívida não encontrada.");

      if (d.parcelasTotal <= divida.pagas) {
        throw new ErroDeRegra(
          divida.pagas === 0
            ? "A dívida precisa ter pelo menos uma parcela."
            : `Você já pagou ${divida.pagas} ${divida.pagas === 1 ? "parcela" : "parcelas"}. O total não pode ser menor que isso.`,
        );
      }

      // As pagas continuam com o valor e a data que tiveram de fato; o novo
      // cronograma vale da próxima em diante.
      const pendentes = d.parcelasTotal - divida.pagas;
      const datas = Array.from({ length: pendentes }, (_, i) =>
        mesmoDiaNoMes(d.proximoVencimento, i),
      );

      await tx
        .delete(debtInstallments)
        .where(
          and(
            eq(debtInstallments.debtId, divida.id),
            eq(debtInstallments.workspaceId, workspace.workspaceId),
            eq(debtInstallments.status, "pending"),
          ),
        );

      await tx.insert(debtInstallments).values(
        datas.map((data, i) => ({
          id: newId(),
          debtId: divida.id,
          workspaceId: workspace.workspaceId,
          number: divida.pagas + i + 1,
          amount: parcela,
          dueDate: data,
          paidAmount: 0,
          status: "pending" as const,
        })),
      );

      await tx
        .update(debts)
        .set({
          ownerId: d.titularidade === "conjunto" ? null : usuario.id,
          name: d.nome,
          creditor: d.credor ?? null,
          // O total soma o que já foi pago de verdade com o novo cronograma —
          // não `parcela * total`, que reescreveria o passado.
          principalAmount: divida.valorPago + parcela * pendentes,
          totalAmount: divida.valorPago + parcela * pendentes,
          installmentsTotal: d.parcelasTotal,
          endDate: datas[datas.length - 1] ?? null,
          dueDay: Number(d.proximoVencimento.slice(-2)),
          updatedAt: new Date(),
        })
        .where(eq(debts.id, divida.id));
    });
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }

  revalidatePath("/dividas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/** Erro de regra disparado dentro da transacao — o throw desfaz a escrita. */
class ErroDeRegra extends Error {}

/**
 * Exclui a divida inteira, com as parcelas.
 *
 * So' quando nada dela virou dinheiro ainda. Com parcela paga existe
 * lancamento no extrato apontando pra ca'; apagar deixaria despesa orfa. Com
 * historico o caminho e' arquivar.
 */
export async function excluirDivida(id: string): Promise<EstadoDivida> {
  const { workspace } = await exigirSessao();

  const [divida] = await db
    .select({ pagas: debts.installmentsPaid })
    .from(debts)
    .where(and(eq(debts.id, id), eq(debts.workspaceId, workspace.workspaceId)))
    .limit(1);

  if (!divida) return { erro: "Dívida não encontrada." };

  if (divida.pagas > 0) {
    return {
      erro: `Esta dívida já tem ${divida.pagas} ${divida.pagas === 1 ? "parcela paga" : "parcelas pagas"} no extrato. Arquive em vez de excluir, ou desfaça os pagamentos primeiro.`,
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(debtInstallments)
      .where(
        and(
          eq(debtInstallments.debtId, id),
          eq(debtInstallments.workspaceId, workspace.workspaceId),
        ),
      );
    await tx.delete(debts).where(and(eq(debts.id, id), eq(debts.workspaceId, workspace.workspaceId)));
  });

  revalidatePath("/dividas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/** Tira a divida das listas sem apagar o historico dela. */
export async function arquivarDivida(id: string, arquivar = true): Promise<EstadoDivida> {
  const { workspace } = await exigirSessao();

  await db
    .update(debts)
    .set({ status: arquivar ? "canceled" : "active", updatedAt: new Date() })
    .where(and(eq(debts.id, id), eq(debts.workspaceId, workspace.workspaceId)));

  revalidatePath("/dividas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Desfaz o pagamento de uma parcela: apaga o lancamento gerado, devolve o
 * valor ao saldo da conta e volta a parcela e a divida ao estado anterior.
 *
 * Espelho exato de `pagarParcela`. E' o que permite corrigir um valor pago
 * errado sem deixar o extrato e a divida divergindo.
 */
export async function desfazerPagamentoParcela(parcelaId: string): Promise<EstadoDivida> {
  const { workspace } = await exigirSessao();

  await db.transaction(async (tx) => {
    const [parcela] = await tx
      .select({
        id: debtInstallments.id,
        debtId: debtInstallments.debtId,
        valor: debtInstallments.amount,
        pago: debtInstallments.paidAmount,
        status: debtInstallments.status,
        lancamentoId: debtInstallments.transactionId,
      })
      .from(debtInstallments)
      .where(
        and(
          eq(debtInstallments.id, parcelaId),
          eq(debtInstallments.workspaceId, workspace.workspaceId),
        ),
      )
      .limit(1);

    if (!parcela || parcela.status !== "paid") return;

    if (parcela.lancamentoId) {
      const [lancamento] = await tx
        .select({
          id: transactions.id,
          valor: transactions.amount,
          contaId: transactions.accountId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.id, parcela.lancamentoId),
            eq(transactions.workspaceId, workspace.workspaceId),
          ),
        )
        .limit(1);

      if (lancamento) {
        await tx.delete(transactions).where(eq(transactions.id, lancamento.id));

        if (lancamento.contaId) {
          // Era despesa: devolver ao saldo.
          await tx
            .update(financialAccounts)
            .set({
              currentBalance: sql`${financialAccounts.currentBalance} + ${lancamento.valor}`,
              updatedAt: new Date(),
            })
            .where(eq(financialAccounts.id, lancamento.contaId));
        }
      }
    }

    await tx
      .update(debtInstallments)
      .set({
        status: "pending",
        paidAmount: 0,
        paidAt: null,
        transactionId: null,
        updatedAt: new Date(),
      })
      .where(eq(debtInstallments.id, parcela.id));

    // `pago` e nao `valor`: se a parcela foi quitada com valor diferente do
    // previsto, e' o valor efetivamente pago que precisa sair do acumulado.
    await tx
      .update(debts)
      .set({
        paidAmount: sql`greatest(${debts.paidAmount} - ${parcela.pago}, 0)`,
        installmentsPaid: sql`greatest(${debts.installmentsPaid} - 1, 0)`,
        // Reabre a dívida: ela tinha fechado sozinha ao quitar a última.
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(debts.id, parcela.debtId));
  });

  revalidatePath("/dividas");
  revalidatePath("/lancamentos");
  revalidatePath("/contas");
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
