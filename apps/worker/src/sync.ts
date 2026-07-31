import {
  and,
  cardInvoices,
  creditCards,
  db,
  eq,
  financialAccounts,
  openFinanceConnections,
  openFinanceLinks,
  openFinanceSyncRuns,
  transactions,
} from "@finara/db";
import { randomUUID } from "node:crypto";
import type { Account, Transaction } from "pluggy-sdk";
import { pluggy } from "./pluggy";

/**
 * Converte valor monetario do Pluggy (unidade da moeda, ex. 1234.56) para a
 * convencao do Finara (centavos inteiros). O arredondamento e' obrigatorio:
 * 1234.56 * 100 da' 123455.99999999999 em ponto flutuante.
 */
function paraCentavos(valor: number): number {
  return Math.round(valor * 100);
}

/**
 * Data do fato no fuso de Sao Paulo, no formato 'YYYY-MM-DD'.
 *
 * NAO usar toISOString().slice(0,10): uma compra as 23h de 30/07 em Brasilia
 * e' 02h de 31/07 em UTC, e o gasto apareceria no dia errado do calendario.
 * 'en-CA' e' o truque que devolve o formato ISO ja' no fuso pedido.
 */
const formatadorData = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function paraDataLocal(data: Date): string {
  return formatadorData.format(data);
}

/** 'YYYY-MM' da mesma data — usado como mes de referencia da fatura. */
function paraMesReferencia(data: Date): string {
  return paraDataLocal(data).slice(0, 7);
}

export type ResultadoSync = {
  contasVinculadas: number;
  criadas: number;
  atualizadas: number;
};

/**
 * Importa contas e lancamentos de uma conexao.
 *
 * Idempotente por construcao: cada lancamento carrega o par
 * (connectionId, externalId), que tem indice unico. Rodar duas vezes
 * atualiza, nunca duplica — importante porque o Pluggy reenvia webhook
 * quando nao recebe 2XX a tempo.
 */
export async function sincronizarConexao(connectionId: string): Promise<ResultadoSync> {
  const runId = randomUUID();

  const [conexao] = await db
    .select()
    .from(openFinanceConnections)
    .where(eq(openFinanceConnections.id, connectionId))
    .limit(1);

  if (!conexao?.externalItemId) {
    throw new Error(`Conexao ${connectionId} sem item do Pluggy.`);
  }

  await db.insert(openFinanceSyncRuns).values({
    id: runId,
    connectionId,
    status: "running",
  });

  const resultado: ResultadoSync = { contasVinculadas: 0, criadas: 0, atualizadas: 0 };

  try {
    const { results: contas } = await pluggy.fetchAccounts(conexao.externalItemId);

    for (const conta of contas) {
      const vinculo = await vincularConta({
        workspaceId: conexao.workspaceId,
        connectionId,
        conta,
      });
      resultado.contasVinculadas += 1;

      // fetchAllTransactions varre todas as paginas via cursor.
      // fetchTransactions esta' deprecado no SDK.
      const lancamentos = await pluggy.fetchAllTransactions(conta.id);

      for (const lancamento of lancamentos) {
        const novo = await gravarLancamento({
          workspaceId: conexao.workspaceId,
          connectionId,
          conta,
          vinculo,
          lancamento,
        });
        if (novo) resultado.criadas += 1;
        else resultado.atualizadas += 1;
      }
    }

    await db
      .update(openFinanceSyncRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        transactionsImported: {
          created: resultado.criadas,
          updated: resultado.atualizadas,
          skipped: 0,
        },
      })
      .where(eq(openFinanceSyncRuns.id, runId));

    await db
      .update(openFinanceConnections)
      .set({ status: "active", statusDetail: null, lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(openFinanceConnections.id, connectionId));

    return resultado;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);

    await db
      .update(openFinanceSyncRuns)
      .set({ status: "failed", finishedAt: new Date(), errorMessage: mensagem })
      .where(eq(openFinanceSyncRuns.id, runId));

    await db
      .update(openFinanceConnections)
      .set({ status: "error", statusDetail: mensagem, updatedAt: new Date() })
      .where(eq(openFinanceConnections.id, connectionId));

    throw erro;
  }
}

type Vinculo = { financialAccountId: string | null; creditCardId: string | null };

/**
 * Garante que a conta do Pluggy tenha correspondente no Finara.
 * Conta BANK vira conta financeira; CREDIT vira cartao de credito.
 */
async function vincularConta(params: {
  workspaceId: string;
  connectionId: string;
  conta: Account;
}): Promise<Vinculo> {
  const { workspaceId, connectionId, conta } = params;

  const [existente] = await db
    .select()
    .from(openFinanceLinks)
    .where(
      and(
        eq(openFinanceLinks.connectionId, connectionId),
        eq(openFinanceLinks.externalAccountId, conta.id),
      ),
    )
    .limit(1);

  if (existente) {
    // Saldo muda a cada sync; o vinculo em si nao.
    if (existente.financialAccountId) {
      await db
        .update(financialAccounts)
        .set({ currentBalance: paraCentavos(conta.balance), updatedAt: new Date() })
        .where(eq(financialAccounts.id, existente.financialAccountId));
    }
    return {
      financialAccountId: existente.financialAccountId,
      creditCardId: existente.creditCardId,
    };
  }

  const vinculo: Vinculo = { financialAccountId: null, creditCardId: null };

  if (conta.type === "CREDIT") {
    const id = randomUUID();
    await db.insert(creditCards).values({
      id,
      workspaceId,
      name: conta.name || conta.marketingName || "Cartão",
      brand: conta.creditData?.brand ?? null,
      lastFourDigits: conta.number?.slice(-4) ?? null,
      creditLimit: paraCentavos(conta.creditData?.availableCreditLimit ?? 0),
      // Sem os dias do ciclo o cartao fica sem fatura; caimos no dia 1 e o
      // usuario ajusta na tela — melhor que recusar a importacao inteira.
      closingDay: conta.creditData?.balanceCloseDate
        ? new Date(conta.creditData.balanceCloseDate).getDate()
        : 1,
      dueDay: conta.creditData?.balanceDueDate
        ? new Date(conta.creditData.balanceDueDate).getDate()
        : 10,
    });
    vinculo.creditCardId = id;
  } else {
    const id = randomUUID();
    await db.insert(financialAccounts).values({
      id,
      workspaceId,
      name: conta.name || conta.marketingName || "Conta",
      type: conta.subtype === "SAVINGS_ACCOUNT" ? "savings" : "checking",
      institution: conta.marketingName ?? null,
      currency: conta.currencyCode ?? "BRL",
      initialBalance: paraCentavos(conta.balance),
      currentBalance: paraCentavos(conta.balance),
    });
    vinculo.financialAccountId = id;
  }

  await db.insert(openFinanceLinks).values({
    id: randomUUID(),
    connectionId,
    workspaceId,
    externalAccountId: conta.id,
    externalAccountName: conta.name,
    financialAccountId: vinculo.financialAccountId,
    creditCardId: vinculo.creditCardId,
  });

  return vinculo;
}

/** Grava o lancamento. Retorna true se foi criado agora, false se ja' existia. */
async function gravarLancamento(params: {
  workspaceId: string;
  connectionId: string;
  conta: Account;
  vinculo: Vinculo;
  lancamento: Transaction;
}): Promise<boolean> {
  const { workspaceId, connectionId, vinculo, lancamento } = params;

  const data = paraDataLocal(new Date(lancamento.date));

  // O sinal do valor fica em `type`, nunca no numero — a convencao do Finara
  // e' guardar sempre valor positivo (ver o schema de transactions).
  const tipo = lancamento.type === "CREDIT" ? "income" : "expense";

  const invoiceId = vinculo.creditCardId
    ? await garantirFatura({
        workspaceId,
        cardId: vinculo.creditCardId,
        data: new Date(lancamento.date),
      })
    : null;

  const resultado = await db
    .insert(transactions)
    .values({
      id: randomUUID(),
      workspaceId,
      type: tipo,
      status: lancamento.status === "PENDING" ? "pending" : "cleared",
      amount: Math.abs(paraCentavos(lancamento.amount)),
      currency: lancamento.currencyCode ?? "BRL",
      description: lancamento.description || "Lançamento importado",
      date: data,
      accountId: vinculo.financialAccountId,
      cardId: vinculo.creditCardId,
      invoiceId,
      // ownerId nulo = lancamento conjunto. Quem importou nao decide de quem
      // e' o gasto; o usuario atribui depois na tela.
      ownerId: null,
      externalId: lancamento.id,
      connectionId,
    })
    .onConflictDoUpdate({
      target: [transactions.connectionId, transactions.externalId],
      set: {
        amount: Math.abs(paraCentavos(lancamento.amount)),
        description: lancamento.description || "Lançamento importado",
        date: data,
        status: lancamento.status === "PENDING" ? "pending" : "cleared",
        updatedAt: new Date(),
      },
    })
    .returning({ criadoEm: transactions.createdAt, atualizadoEm: transactions.updatedAt });

  const linha = resultado[0];
  if (!linha) return false;

  // Se as duas datas batem, a linha nasceu agora.
  return linha.criadoEm.getTime() === linha.atualizadoEm.getTime();
}

/** Fatura do mes daquele lancamento, criada sob demanda. */
async function garantirFatura(params: {
  workspaceId: string;
  cardId: string;
  data: Date;
}): Promise<string> {
  const { workspaceId, cardId, data } = params;
  const referencia = paraMesReferencia(data);

  const [existente] = await db
    .select({ id: cardInvoices.id })
    .from(cardInvoices)
    .where(and(eq(cardInvoices.cardId, cardId), eq(cardInvoices.referenceMonth, referencia)))
    .limit(1);

  if (existente) return existente.id;

  const [cartao] = await db
    .select({ closingDay: creditCards.closingDay, dueDay: creditCards.dueDay })
    .from(creditCards)
    .where(eq(creditCards.id, cardId))
    .limit(1);

  const [ano, mes] = referencia.split("-").map(Number) as [number, number];
  const diaFecha = Math.min(cartao?.closingDay ?? 1, 28);
  const diaVence = Math.min(cartao?.dueDay ?? 10, 28);

  const id = randomUUID();
  await db.insert(cardInvoices).values({
    id,
    workspaceId,
    cardId,
    referenceMonth: referencia,
    closingDate: `${referencia}-${String(diaFecha).padStart(2, "0")}`,
    // Vencimento antes do fechamento significa que cai no mes seguinte.
    dueDate:
      diaVence >= diaFecha
        ? `${referencia}-${String(diaVence).padStart(2, "0")}`
        : `${mes === 12 ? ano + 1 : ano}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-${String(diaVence).padStart(2, "0")}`,
  });

  return id;
}
