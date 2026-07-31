"use client";

import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PencilSimpleIcon,
  SparkleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { excluirLancamento } from "@/app/(app)/lancamentos/actions";
import {
  FormLancamento,
  type LancamentoEditavel,
} from "@/components/lancamentos/form-lancamento";
import { AcoesLinha } from "@/components/ui/acoes-linha";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { rotuloData } from "@/lib/datas";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Opcao = { id: string; nome: string };

/** Uma linha do extrato, do jeito que a consulta devolve. */
export type LinhaLancamento = {
  id: string;
  descricao: string;
  valor: number;
  tipo: "expense" | "income" | "transfer";
  status: string;
  data: string;
  ownerId: string | null;
  categoria: string | null;
  categoriaCor: string | null;
  origem: string | null;
  importado: boolean;
  parcela: number | null;
  parcelasTotal: number | null;
  categoriaId: string | null;
  contaId: string | null;
  cartaoId: string | null;
  observacao: string | null;
  grupoParcelas: string | null;
};

export function ListaLancamentos({
  lancamentos,
  hoje,
  usuarioId,
  contas,
  cartoes,
  categorias,
  temParceiro,
}: {
  lancamentos: LinhaLancamento[];
  hoje: string;
  usuarioId: string;
  contas: Opcao[];
  cartoes: Opcao[];
  categorias: (Opcao & { tipo: string })[];
  temParceiro: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);

  // Agrupa por dia: no extrato, ver o total do dia importa mais que a hora.
  const porDia = new Map<string, LinhaLancamento[]>();
  for (const l of lancamentos) {
    const lista = porDia.get(l.data) ?? [];
    lista.push(l);
    porDia.set(l.data, lista);
  }

  const alvo = lancamentos.find((l) => l.id === editando);

  return (
    <CardContent className="p-0">
      {/* Uma caixa de edição para a lista inteira: a `key` remonta os campos
          ao trocar de lançamento, e o DOM não carrega 100 formulários
          escondidos. Mesmo padrão da tela de categorias. */}
      {alvo && (
        <Modal
          aberto
          aoFechar={() => setEditando(null)}
          titulo="Editar lançamento"
          descricao={
            alvo.parcelasTotal && alvo.parcelasTotal > 1
              ? "Escolha se a mudança vale só para esta parcela ou para a compra."
              : "Corrigir valor, data, categoria ou de onde saiu."
          }
        >
          <FormLancamento
            key={alvo.id}
            contas={contas}
            cartoes={cartoes}
            categorias={categorias}
            dataPadrao={hoje}
            temParceiro={temParceiro}
            aoConcluir={() => setEditando(null)}
            lancamento={paraEditavel(alvo, usuarioId)}
          />
        </Modal>
      )}

      {[...porDia.entries()].map(([dia, itens], grupo) => {
        const totalDia = itens.reduce(
          (acc, i) => acc + (i.tipo === "income" ? i.valor : -i.valor),
          0,
        );

        return (
          <section key={dia}>
            <div className="flex items-baseline justify-between gap-3 border-b border-border bg-surface-2/50 px-5 py-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-subtle">
                {rotuloData(dia, hoje)}
              </span>
              <span
                className={cn(
                  "tabular text-[12.5px] font-medium",
                  totalDia >= 0 ? "text-income" : "text-muted",
                )}
              >
                {totalDia >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(totalDia))}
              </span>
            </div>

            <ul className="divide-y divide-border">
              {itens.map((l, i) => (
                <Linha
                  key={l.id}
                  lancamento={l}
                  atraso={Math.min(grupo * 40 + i * 20, 300)}
                  aoEditar={() => setEditando(l.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </CardContent>
  );
}

function paraEditavel(l: LinhaLancamento, usuarioId: string): LancamentoEditavel {
  return {
    id: l.id,
    // "transfer" não é editável por este formulário; cai como despesa para
    // não quebrar o tipo. A UI não oferece editar transferência hoje.
    tipo: l.tipo === "income" ? "income" : "expense",
    valor: l.valor,
    descricao: l.descricao,
    data: l.data,
    categoriaId: l.categoriaId,
    contaId: l.contaId,
    cartaoId: l.cartaoId,
    observacao: l.observacao,
    // ownerId nulo = conjunto. Só é "meu" se for de quem está olhando.
    titularidade: l.ownerId === usuarioId ? "meu" : "conjunto",
    parcela: l.parcela,
    parcelasTotal: l.parcelasTotal,
  };
}

function Linha({
  lancamento: l,
  atraso,
  aoEditar,
}: {
  lancamento: LinhaLancamento;
  atraso: number;
  aoEditar: () => void;
}) {
  const [escopoExclusao, setEscopoExclusao] = useState<"uma" | "todas" | null>(null);
  const parcelada = Boolean(l.parcelasTotal && l.parcelasTotal > 1);

  return (
    <li
      className="group flex animate-[fade-up_0.35s_var(--ease-out-quint)_both] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          l.tipo === "income" ? "bg-income-soft text-income" : "bg-expense-soft text-expense",
        )}
      >
        {l.tipo === "income" ? (
          <ArrowDownLeftIcon size={16} weight="bold" />
        ) : (
          <ArrowUpRightIcon size={16} weight="bold" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-text">
          {l.descricao}
          {/* Compra parcelada: sem isto, doze linhas iguais no extrato
              parecem doze compras repetidas. */}
          {l.parcela && l.parcelasTotal && (
            <span className="tabular shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-muted">
              {l.parcela}/{l.parcelasTotal}
            </span>
          )}
          {l.importado && (
            <SparkleIcon
              size={12}
              weight="fill"
              className="shrink-0 text-primary"
              aria-label="Importado automaticamente"
            />
          )}
        </p>
        <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
          {l.categoria && (
            <span className="flex items-center gap-1">
              <span
                className="size-1.5 rounded-full"
                style={{ background: l.categoriaCor ?? "var(--text-subtle)" }}
              />
              {l.categoria}
            </span>
          )}
          {l.categoria && l.origem && <span>·</span>}
          {l.origem}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {l.status === "pending" && <Badge tone="warning">Previsto</Badge>}
        <span
          className={cn(
            "tabular text-[13.5px] font-semibold",
            l.tipo === "income" ? "text-income" : "text-text",
          )}
        >
          {l.tipo === "income" ? "+" : "−"}
          {formatMoney(l.valor)}
        </span>
      </div>

      {/* Numa compra parcelada, excluir pergunta o alcance antes: apagar só a
          parcela 3 de 12 é pedido legítimo, mas o caso comum é desfazer a
          compra inteira — e apagar tudo sem perguntar seria destrutivo. */}
      {parcelada && escopoExclusao === null ? (
        <EscolhaExclusao
          total={l.parcelasTotal!}
          numero={l.parcela!}
          aoEditar={aoEditar}
          aoEscolher={setEscopoExclusao}
        />
      ) : (
        <AcoesLinha
          key={escopoExclusao ?? "simples"}
          acoes={[
            {
              rotulo: "Editar lançamento",
              icone: <PencilSimpleIcon size={15} weight="bold" />,
              aoClicar: aoEditar,
            },
            {
              rotulo:
                escopoExclusao === "todas" ? "Excluir a compra inteira" : "Excluir lançamento",
              icone: <TrashIcon size={15} weight="bold" />,
              perigo: true,
              confirmar: escopoExclusao === "todas" ? "Excluir as parcelas?" : "Excluir?",
              executar: () => excluirLancamento(l.id, escopoExclusao ?? "uma"),
            },
          ]}
        />
      )}
    </li>
  );
}

/** Passo intermediario so' das compras parceladas. */
function EscolhaExclusao({
  total,
  numero,
  aoEditar,
  aoEscolher,
}: {
  total: number;
  numero: number;
  aoEditar: () => void;
  aoEscolher: (escopo: "uma" | "todas") => void;
}) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <AcoesLinha
        acoes={[
          {
            rotulo: "Editar lançamento",
            icone: <PencilSimpleIcon size={15} weight="bold" />,
            aoClicar: aoEditar,
          },
          {
            rotulo: "Excluir lançamento",
            icone: <TrashIcon size={15} weight="bold" />,
            perigo: true,
            aoClicar: () => setAberto(true),
          },
        ]}
      />
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      <span className="text-[11.5px] text-muted">Excluir</span>
      <button
        type="button"
        onClick={() => aoEscolher("uma")}
        className="rounded-lg border border-border px-2 py-1 text-[11.5px] text-text transition-colors hover:bg-surface-2"
      >
        só a {numero}/{total}
      </button>
      <button
        type="button"
        onClick={() => aoEscolher("todas")}
        className="rounded-lg border border-border px-2 py-1 text-[11.5px] text-text transition-colors hover:bg-surface-2"
      >
        as {total} parcelas
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-lg px-2 py-1 text-[11.5px] text-muted transition-colors hover:bg-surface-2"
      >
        cancelar
      </button>
    </div>
  );
}
