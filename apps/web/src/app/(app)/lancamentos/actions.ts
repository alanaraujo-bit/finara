"use server";

import { and, creditCards, db, eq, financialAccounts, sql, transactions } from "@finara/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mesmoDiaNoMes } from "@/lib/datas";
import { cicloDaCompra, cicloDaReferencia, referenciaMaisMeses } from "@/lib/faturas";
import { newId } from "@/lib/id";
import { parseMoney } from "@/lib/money";
import { garantirFatura } from "@/lib/queries/cartoes";
import { exigirSessao } from "@/lib/session";
import { travaDoLancamento } from "@/lib/travas-lancamento";

const esquema = z.object({
  tipo: z.enum(["expense", "income"]),
  valor: z.string().min(1, "Informe o valor."),
  descricao: z.string().trim().min(1, "Descreva o lançamento.").max(120),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  categoriaId: z.string().optional(),
  // "conta:<id>" ou "cartao:<id>". Um campo so' no formulario evita o estado
  // invalido de ter conta E cartao preenchidos ao mesmo tempo.
  origem: z.string().optional(),
  titularidade: z.enum(["conjunto", "meu"]),
  observacao: z.string().trim().max(500).optional(),
  // Parcelamento de compra no cartao. 1 = a vista.
  parcelas: z.coerce.number().int().min(1).max(36, "No máximo 36 parcelas.").default(1),
});

export type EstadoLancamento = { erro?: string; ok?: boolean };

/**
 * Cria um lancamento manual.
 *
 * O saldo da conta e' materializado (`currentBalance`), entao ele e' ajustado
 * na MESMA transacao do insert. Fazer em duas idas ao banco abriria uma janela
 * em que o extrato mostra o gasto e o saldo ainda nao — num app de dinheiro,
 * essa incoerencia destroi a confianca do usuario no numero.
 */
export async function criarLancamento(
  _anterior: EstadoLancamento,
  form: FormData,
): Promise<EstadoLancamento> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquema.safeParse({
    tipo: form.get("tipo"),
    valor: form.get("valor"),
    descricao: form.get("descricao"),
    data: form.get("data"),
    categoriaId: form.get("categoriaId") || undefined,
    origem: form.get("origem") || undefined,
    titularidade: form.get("titularidade"),
    observacao: form.get("observacao") || undefined,
    parcelas: form.get("parcelas") || "1",
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { tipo, valor, descricao, data, categoriaId, origem, titularidade, observacao, parcelas } =
    parsed.data;

  const centavos = parseMoney(valor);

  if (centavos <= 0) {
    return { erro: "O valor precisa ser maior que zero." };
  }

  const [genero, alvoId] = (origem ?? "").split(":");

  let contaValida: string | null = null;
  let cartao: { id: string; fechamento: number; vencimento: number } | null = null;

  // Id vindo do formulario nao e' confiavel: sempre confirmar que pertence
  // a este workspace antes de usar.
  if (genero === "conta" && alvoId) {
    const [c] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, alvoId),
          eq(financialAccounts.workspaceId, workspace.workspaceId),
        ),
      )
      .limit(1);

    if (!c) return { erro: "Conta não encontrada." };
    contaValida = c.id;
  } else if (genero === "cartao" && alvoId) {
    const [c] = await db
      .select({
        id: creditCards.id,
        fechamento: creditCards.closingDay,
        vencimento: creditCards.dueDay,
      })
      .from(creditCards)
      .where(
        and(eq(creditCards.id, alvoId), eq(creditCards.workspaceId, workspace.workspaceId)),
      )
      .limit(1);

    if (!c) return { erro: "Cartão não encontrado." };
    if (tipo === "income") {
      return { erro: "Cartão de crédito só recebe despesas. Escolha uma conta para entradas." };
    }
    cartao = c;
  }

  if (parcelas > 1 && !cartao) {
    return { erro: "Parcelamento só existe em compra no cartão de crédito." };
  }

  // Divisao em centavos: a sobra vai para a PRIMEIRA parcela, como fazem as
  // administradoras. Sem isso a soma das parcelas nao fecha com o preco.
  const base = Math.floor(centavos / parcelas);
  const sobra = centavos - base * parcelas;
  const grupoId = parcelas > 1 ? newId() : null;

  // Ciclo da PRIMEIRA parcela: as demais andam sobre o mes de referencia
  // dele, nunca sao re-inferidas de uma data de calendario (ver o comentario
  // de `referenciaMaisMeses` — inferir de novo colide fevereiro com janeiro
  // sempre que o fechamento cai no dia 28).
  const cicloBase = cartao ? cicloDaCompra(data, cartao.fechamento, cartao.vencimento) : null;

  await db.transaction(async (tx) => {
    const executor = tx as unknown as typeof db;

    for (let i = 0; i < parcelas; i++) {
      // Data do lancamento em si (calendario/extrato). Independente da
      // fatura: uma parcela pode ter dia de calendario 28 de fevereiro e
      // ainda assim pertencer ao SEU proprio ciclo, distinto do da vizinha.
      const dataDaParcela = i === 0 ? data : mesmoDiaNoMes(data, i);

      const invoiceId =
        cartao && cicloBase
          ? await garantirFatura({
              workspaceId: workspace.workspaceId,
              cardId: cartao.id,
              ciclo: cicloDaReferencia(
                referenciaMaisMeses(cicloBase.referencia, i),
                cartao.fechamento,
                cartao.vencimento,
              ),
              executor,
            })
          : null;

      await tx.insert(transactions).values({
        id: newId(),
        workspaceId: workspace.workspaceId,
        type: tipo,
        status: "cleared",
        // Sempre positivo — o sinal mora em `type`. Ver o schema.
        amount: i === 0 ? base + sobra : base,
        description: descricao,
        notes: observacao ?? null,
        date: dataDaParcela,
        // Competencia fica na data da COMPRA: e' o mes em que o gasto pesa,
        // mesmo que a parcela caia um ano depois.
        competenceDate: parcelas > 1 ? data : null,
        accountId: contaValida,
        cardId: cartao?.id ?? null,
        invoiceId,
        categoryId: categoriaId || null,
        ownerId: titularidade === "conjunto" ? null : usuario.id,
        installmentNumber: parcelas > 1 ? i + 1 : null,
        installmentTotal: parcelas > 1 ? parcelas : null,
        installmentGroupId: grupoId,
      });
    }

    if (contaValida) {
      const delta = tipo === "income" ? centavos : -centavos;
      await tx
        .update(financialAccounts)
        .set({
          currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
          updatedAt: new Date(),
        })
        .where(eq(financialAccounts.id, contaValida));
    }
  });

  revalidatePath("/cartoes");

  revalidatePath("/lancamentos");
  revalidatePath("/");
  return { ok: true };
}

/* ═══════════════════════════════════════════════════════ edicao ═══════════ */

/**
 * Erro de regra de negocio disparado DENTRO da transacao.
 *
 * Serve a dois propositos de uma vez: desfaz a escrita parcial (o throw faz o
 * rollback) e carrega a mensagem para a UI. Sem isso, checar as regras antes
 * de abrir a transacao deixaria uma janela em que a fatura e' paga entre a
 * checagem e a escrita.
 */
class ErroDeRegra extends Error {}

/**
 * Alcance da edicao numa compra parcelada:
 *   uma    — so' a parcela aberta (unico caso em que data e origem mudam)
 *   daqui  — esta e as seguintes, util quando o valor reajusta no meio
 *   todas  — a compra inteira
 */
const escopoEdicao = z.enum(["uma", "daqui", "todas"]).default("uma");

const esquemaEdicao = esquema
  .omit({ parcelas: true })
  .extend({ id: z.string().min(1), escopo: escopoEdicao });

/** Campos que fazem sentido propagar entre parcelas de uma mesma compra. */
type CamposComuns = {
  type: "expense" | "income";
  amount: number;
  description: string;
  notes: string | null;
  categoryId: string | null;
  ownerId: string | null;
  updatedAt: Date;
};

/**
 * Edita um lancamento.
 *
 * O saldo materializado e' corrigido pelo par estorna-e-reaplica: desfaz o
 * efeito da versao antiga na conta antiga e aplica o da nova na conta nova.
 * Calcular so' a diferenca do valor daria errado assim que o tipo
 * (despesa/receita) ou a conta mudassem — que sao justamente as correcoes
 * mais comuns.
 *
 * Data e origem so' sao alteradas no escopo "uma": nas outras parcelas, cada
 * uma tem a sua data de calendario e a sua fatura, e sobrescrever isso em
 * bloco colidiria parcelas no mesmo ciclo.
 */
export async function editarLancamento(
  _anterior: EstadoLancamento,
  form: FormData,
): Promise<EstadoLancamento> {
  const { usuario, workspace } = await exigirSessao();

  const parsed = esquemaEdicao.safeParse({
    id: form.get("id"),
    escopo: form.get("escopo") || "uma",
    tipo: form.get("tipo"),
    valor: form.get("valor"),
    descricao: form.get("descricao"),
    data: form.get("data"),
    categoriaId: form.get("categoriaId") || undefined,
    origem: form.get("origem") || undefined,
    titularidade: form.get("titularidade"),
    observacao: form.get("observacao") || undefined,
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const centavos = parseMoney(d.valor);

  if (centavos <= 0) return { erro: "O valor precisa ser maior que zero." };

  try {
    await db.transaction(async (tx) => {
      const executor = tx as unknown as typeof db;

      const [alvo] = await tx
        .select({
          id: transactions.id,
          tipo: transactions.type,
          valor: transactions.amount,
          contaId: transactions.accountId,
          cartaoId: transactions.cardId,
          grupoId: transactions.installmentGroupId,
          numero: transactions.installmentNumber,
        })
        .from(transactions)
        .where(and(eq(transactions.id, d.id), eq(transactions.workspaceId, workspace.workspaceId)))
        .limit(1);

      if (!alvo) throw new ErroDeRegra("Lançamento não encontrado.");

      // Escopo amplo so' existe dentro de uma compra parcelada.
      const escopo = alvo.grupoId ? d.escopo : "uma";

      const afetados =
        escopo === "uma"
          ? [alvo.id]
          : (
              await tx
                .select({ id: transactions.id, numero: transactions.installmentNumber })
                .from(transactions)
                .where(
                  and(
                    eq(transactions.installmentGroupId, alvo.grupoId!),
                    eq(transactions.workspaceId, workspace.workspaceId),
                  ),
                )
            )
              .filter((p) => escopo === "todas" || (p.numero ?? 0) >= (alvo.numero ?? 0))
              .map((p) => p.id);

      // Cada parcela afetada precisa passar pela trava: uma delas pode estar
      // numa fatura ja' paga mesmo que a aberta nao esteja.
      for (const id of afetados) {
        const trava = await travaDoLancamento(executor, workspace.workspaceId, id);
        if (trava) throw new ErroDeRegra(trava.motivo);
      }

      const comuns: CamposComuns = {
        type: d.tipo,
        amount: centavos,
        description: d.descricao,
        notes: d.observacao ?? null,
        categoryId: d.categoriaId || null,
        ownerId: d.titularidade === "conjunto" ? null : usuario.id,
        updatedAt: new Date(),
      };

      if (escopo !== "uma") {
        // Parcelamento só existe no cartão, então nenhuma dessas linhas tem
        // conta — não há saldo a mexer, só o valor de cada parcela.
        for (const id of afetados) {
          await tx.update(transactions).set(comuns).where(eq(transactions.id, id));
        }
        return;
      }

      /* ─── escopo "uma": data e origem entram ─────────────────────────── */

      const [genero, alvoId] = (d.origem ?? "").split(":");
      let contaNova: string | null = null;
      let cartaoNovo: { id: string; fechamento: number; vencimento: number } | null = null;

      // Id vindo de formulario nunca e' confiavel: confirmar o workspace.
      if (genero === "conta" && alvoId) {
        const [c] = await tx
          .select({ id: financialAccounts.id })
          .from(financialAccounts)
          .where(
            and(
              eq(financialAccounts.id, alvoId),
              eq(financialAccounts.workspaceId, workspace.workspaceId),
            ),
          )
          .limit(1);
        if (!c) throw new ErroDeRegra("Conta não encontrada.");
        contaNova = c.id;
      } else if (genero === "cartao" && alvoId) {
        const [c] = await tx
          .select({
            id: creditCards.id,
            fechamento: creditCards.closingDay,
            vencimento: creditCards.dueDay,
          })
          .from(creditCards)
          .where(and(eq(creditCards.id, alvoId), eq(creditCards.workspaceId, workspace.workspaceId)))
          .limit(1);
        if (!c) throw new ErroDeRegra("Cartão não encontrado.");
        if (d.tipo === "income") {
          throw new ErroDeRegra(
            "Cartão de crédito só recebe despesas. Escolha uma conta para entradas.",
          );
        }
        cartaoNovo = c;
      }

      const faturaNova = cartaoNovo
        ? await garantirFatura({
            workspaceId: workspace.workspaceId,
            cardId: cartaoNovo.id,
            ciclo: cicloDaCompra(d.data, cartaoNovo.fechamento, cartaoNovo.vencimento),
            executor,
          })
        : null;

      await tx
        .update(transactions)
        .set({
          ...comuns,
          date: d.data,
          accountId: contaNova,
          cardId: cartaoNovo?.id ?? null,
          invoiceId: faturaNova,
        })
        .where(eq(transactions.id, alvo.id));

      /* ─── saldo: estorna o antigo, aplica o novo ─────────────────────── */

      const efeitoAntigo = alvo.tipo === "income" ? alvo.valor : -alvo.valor;
      const efeitoNovo = d.tipo === "income" ? centavos : -centavos;

      if (alvo.contaId === contaNova) {
        // Mesma conta: um UPDATE só, com a diferença líquida.
        const delta = efeitoNovo - efeitoAntigo;
        if (contaNova && delta !== 0) await mexerSaldo(tx, contaNova, delta);
      } else {
        if (alvo.contaId) await mexerSaldo(tx, alvo.contaId, -efeitoAntigo);
        if (contaNova) await mexerSaldo(tx, contaNova, efeitoNovo);
      }
    });
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }

  revalidatePath("/lancamentos");
  revalidatePath("/cartoes");
  revalidatePath("/contas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}

/** Soma `delta` ao saldo materializado da conta. */
async function mexerSaldo(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  contaId: string,
  delta: number,
) {
  await tx
    .update(financialAccounts)
    .set({
      currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(financialAccounts.id, contaId));
}

/**
 * Apaga um lancamento, devolvendo o valor ao saldo da conta.
 * Sem o estorno, apagar um gasto deixaria o saldo permanentemente errado.
 *
 * Numa compra parcelada, `escopo` decide se some so' a parcela ou a compra
 * toda — apagar "a parcela 3 de 12" sozinha e' pedido legitimo (estorno
 * parcial), mas o caso comum e' desfazer a compra inteira.
 */
export async function excluirLancamento(
  id: string,
  escopo: "uma" | "daqui" | "todas" = "uma",
): Promise<EstadoLancamento> {
  const { workspace } = await exigirSessao();

  try {
    await db.transaction(async (tx) => {
      const executor = tx as unknown as typeof db;

      const [alvo] = await tx
        .select({
          id: transactions.id,
          grupoId: transactions.installmentGroupId,
          numero: transactions.installmentNumber,
        })
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.workspaceId, workspace.workspaceId)))
        .limit(1);

      if (!alvo) throw new ErroDeRegra("Lançamento não encontrado.");

      const alcance = alvo.grupoId ? escopo : "uma";

      const linhas =
        alcance === "uma"
          ? await tx
              .select({
                id: transactions.id,
                tipo: transactions.type,
                valor: transactions.amount,
                contaId: transactions.accountId,
                numero: transactions.installmentNumber,
              })
              .from(transactions)
              .where(eq(transactions.id, alvo.id))
          : (
              await tx
                .select({
                  id: transactions.id,
                  tipo: transactions.type,
                  valor: transactions.amount,
                  contaId: transactions.accountId,
                  numero: transactions.installmentNumber,
                })
                .from(transactions)
                .where(
                  and(
                    eq(transactions.installmentGroupId, alvo.grupoId!),
                    eq(transactions.workspaceId, workspace.workspaceId),
                  ),
                )
            ).filter((p) => alcance === "todas" || (p.numero ?? 0) >= (alvo.numero ?? 0));

      for (const linha of linhas) {
        const trava = await travaDoLancamento(executor, workspace.workspaceId, linha.id);
        if (trava) throw new ErroDeRegra(trava.motivo);
      }

      for (const linha of linhas) {
        await tx.delete(transactions).where(eq(transactions.id, linha.id));

        if (linha.contaId) {
          // Estorno: o inverso do que foi aplicado na criacao.
          const delta = linha.tipo === "income" ? -linha.valor : linha.valor;
          await mexerSaldo(tx, linha.contaId, delta);
        }
      }
    });
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }

  revalidatePath("/lancamentos");
  revalidatePath("/cartoes");
  revalidatePath("/contas");
  revalidatePath("/calendario");
  revalidatePath("/");
  return { ok: true };
}
