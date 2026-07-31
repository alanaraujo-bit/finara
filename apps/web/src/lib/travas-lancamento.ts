import {
  and,
  cardInvoices,
  debtInstallments,
  debts,
  eq,
  receivables,
  transactions,
  type db as Db,
} from "@finara/db";

/**
 * TRAVAS DE EDIÇÃO DE LANÇAMENTO
 *
 * A tabela `transactions` é o destino final de quase tudo no app: recebível
 * que entrou, parcela de dívida que foi paga, compra no cartão. Vários desses
 * registros guardam um ponteiro DE VOLTA para o lançamento que geraram
 * (`receivables.transactionId`, `debtInstallments.transactionId`).
 *
 * Editar ou apagar o lançamento direto pela tela de Lançamentos deixaria o
 * recebível dizendo "recebido R$ 500" enquanto o extrato mostra R$ 300 — ou
 * nada. Duas telas do mesmo app afirmando coisas diferentes sobre o mesmo
 * dinheiro é o pior desfecho possível aqui, e é silencioso: ninguém percebe
 * até fechar o mês e a conta não bater.
 *
 * Então o caminho é sempre: desfazer a operação na origem (que estorna a
 * cadeia inteira de forma consistente) e refazer. Duas etapas conscientes em
 * vez de uma que mexe em números que a pessoa não está vendo.
 */

export type Trava = {
  /** Mensagem pronta para a UI, dizendo o caminho e não só o "não". */
  motivo: string;
};

type Executor = typeof Db;

/**
 * Verifica se um lançamento pode ser mexido. Devolve `null` quando pode.
 *
 * Recebe o executor para poder rodar DENTRO da transação que vai fazer a
 * alteração: checar fora dela abriria uma janela em que a fatura é paga entre
 * a checagem e a escrita.
 */
export async function travaDoLancamento(
  executor: Executor,
  workspaceId: string,
  lancamentoId: string,
): Promise<Trava | null> {
  const [recebivel] = await executor
    .select({ nome: receivables.name })
    .from(receivables)
    .where(
      and(
        eq(receivables.transactionId, lancamentoId),
        eq(receivables.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (recebivel) {
    return {
      motivo: `Este lançamento é o recebimento de "${recebivel.nome}". Para mexer nele, desfaça o recebimento em A receber.`,
    };
  }

  const [parcela] = await executor
    .select({ nome: debts.name, numero: debtInstallments.number })
    .from(debtInstallments)
    .innerJoin(debts, eq(debts.id, debtInstallments.debtId))
    .where(
      and(
        eq(debtInstallments.transactionId, lancamentoId),
        eq(debtInstallments.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (parcela) {
    return {
      motivo: `Este lançamento é o pagamento da parcela ${parcela.numero} de "${parcela.nome}". Para mexer nele, desfaça o pagamento em Dívidas.`,
    };
  }

  const [emFaturaPaga] = await executor
    .select({ referencia: cardInvoices.referenceMonth })
    .from(transactions)
    .innerJoin(cardInvoices, eq(cardInvoices.id, transactions.invoiceId))
    .where(
      and(
        eq(transactions.id, lancamentoId),
        eq(transactions.workspaceId, workspaceId),
        eq(cardInvoices.status, "paid"),
      ),
    )
    .limit(1);

  if (emFaturaPaga) {
    return {
      motivo: `Este lançamento está numa fatura já paga (${rotuloReferencia(emFaturaPaga.referencia)}). Desfaça o pagamento da fatura em Cartões para poder editar.`,
    };
  }

  return null;
}

/** 'YYYY-MM' -> 'setembro de 2026'. */
function rotuloReferencia(referencia: string): string {
  const [ano, mes] = referencia.split("-");
  const nomes = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const nome = nomes[Number(mes) - 1];
  return nome ? `${nome} de ${ano}` : referencia;
}
