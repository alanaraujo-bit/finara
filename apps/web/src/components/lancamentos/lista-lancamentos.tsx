"use client";

import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PencilSimpleIcon,
  SparkleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useState, useTransition } from "react";
import { excluirLancamento } from "@/app/(app)/lancamentos/actions";
import {
  FormLancamento,
  type LancamentoEditavel,
} from "@/components/lancamentos/form-lancamento";
import type { Acao } from "@/components/ui/acoes-linha";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Carregando } from "@/components/ui/carregando";
import { LinhaDeslizante } from "@/components/ui/linha-deslizante";
import { Modal } from "@/components/ui/modal";
import { rotuloData } from "@/lib/datas";
import { formatMoney } from "@/lib/money";
import { TATO, vibrar } from "@/lib/tato";
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

  /**
   * Estavel entre renders, e por isso o `memo` de `Linha` funciona.
   *
   * Sem isto, `aoEditar` nascia como uma seta nova a cada render e derrubava a
   * memoizacao de TODAS as linhas: abrir a caixa de edicao de um lancamento
   * re-renderizava os outros 29, com dois `useAcoes` e uma dezena de icones
   * cada. Medido com o processador freado em 4x, isso travava a thread por
   * 426ms — no instante exato do toque, bem antes de a animacao comecar. Era o
   * "trava e buga antes de abrir".
   */
  const abrirEdicao = useCallback((id: string) => setEditando(id), []);

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
                  aoEditar={abrirEdicao}
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

/**
 * `memo` porque esta lista tem 30+ linhas e o estado que abre a caixa de edicao
 * mora no componente de cima. Sem a memoizacao, tocar em "editar" re-renderiza
 * a lista inteira antes de a folha aparecer — e cada linha carrega dois
 * `useAcoes` (com `useRouter` e `useTransition`) mais os icones da gaveta e da
 * pilula. O bloqueio media 426ms com o processador freado em 4x.
 *
 * As tres props sao estaveis: `lancamento` e `atraso` vem do servidor sem
 * mudar de identidade entre renders, e `aoEditar` esta' num `useCallback`.
 */
const Linha = memo(function Linha({
  lancamento: l,
  atraso,
  aoEditar,
}: {
  lancamento: LinhaLancamento;
  atraso: number;
  /** Recebe o id: assim a funcao e' uma so' para a lista toda. */
  aoEditar: (id: string) => void;
}) {
  const [escolhendoEscopo, setEscolhendoEscopo] = useState(false);
  const parcelada = Boolean(l.parcelasTotal && l.parcelasTotal > 1);

  /**
   * As mesmas ações servem o arrasto do celular e o hover do desktop — por
   * isso a lista mora aqui, e não dentro de um dos dois.
   *
   * Editar vem primeiro de propósito: é ela que o arrasto longo dispara, e a
   * primeira posição tem que ser a ação que não estraga nada se acontecer sem
   * querer. Excluir fica no fim, exige mirar, e ainda confirma.
   */
  const acoes: Acao[] = [
    {
      rotulo: "Editar lançamento",
      icone: <PencilSimpleIcon size={15} weight="bold" />,
      aoClicar: () => aoEditar(l.id),
    },
    parcelada
      ? {
          // Numa compra parcelada, excluir precisa saber o alcance antes:
          // apagar só a parcela 3 de 12 é pedido legítimo, mas o caso comum é
          // desfazer a compra inteira — e apagar tudo sem perguntar seria
          // destrutivo. A pergunta vira uma folha, que cabe no dedo.
          rotulo: "Excluir lançamento",
          icone: <TrashIcon size={15} weight="bold" />,
          perigo: true,
          aoClicar: () => setEscolhendoEscopo(true),
        }
      : {
          rotulo: "Excluir lançamento",
          icone: <TrashIcon size={15} weight="bold" />,
          perigo: true,
          confirmar: "Excluir?",
          executar: () => excluirLancamento(l.id, "uma"),
        },
  ];

  return (
    <LinhaDeslizante
      as="li"
      acoes={acoes}
      className="animate-[fade-up_0.35s_var(--ease-out-quint)_both]"
      style={{ animationDelay: `${atraso}ms` }}
    >
      {escolhendoEscopo && (
        <EscolhaExclusao
          id={l.id}
          numero={l.parcela!}
          total={l.parcelasTotal!}
          aoFechar={() => setEscolhendoEscopo(false)}
        />
      )}

      {/* Sem tinta de hover: quem responde ao ponteiro agora é a pílula de
          ações, e um fundo que muda por baixo dela deixaria o degradê da
          pílula (que é `--surface`) visível como uma faixa de cor errada. */}
      <div className="flex items-center gap-3 bg-surface px-5 py-3">
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

      </div>
    </LinhaDeslizante>
  );
});

/**
 * A pergunta de alcance das compras parceladas, numa folha.
 *
 * Era uma fileira de três botõezinhos dentro da própria linha — cabia no
 * mouse, não cabia no dedo, e empurrava o valor da compra para fora da tela
 * enquanto estava aberta. Como folha, a escolha ganha o texto inteiro ("as 12
 * parcelas desta compra"), fica longe do gesto que a abriu e some sozinha ao
 * arrastar para baixo.
 */
function EscolhaExclusao({
  id,
  numero,
  total,
  aoFechar,
}: {
  id: string;
  numero: number;
  total: number;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Esta folha nasce aberta e vive enquanto a linha a mantiver montada — uma
   * por linha, entao deixa-la montada o tempo todo encheria a lista de folhas
   * escondidas.
   *
   * O estado existe para separar as duas coisas que antes eram uma so':
   * "fechar" (pedir a saida, que e' animada) e "sumir" (o `aoFechar` do pai,
   * que desmonta). Concluir a exclusao agora so' pede a saida; o pai desmonta
   * quando a folha ja' desceu.
   */
  const [aberta, setAberta] = useState(true);

  function excluir(escopo: "uma" | "todas") {
    setErro(null);
    iniciar(async () => {
      const r = await excluirLancamento(id, escopo);
      if (r?.erro) {
        setErro(r.erro);
        return;
      }
      vibrar(TATO.concluido);
      setAberta(false);
      router.refresh();
    });
  }

  return (
    <Modal
      aberto={aberta}
      aoFechar={aoFechar}
      titulo="Excluir compra parcelada"
      descricao={`Esta é a parcela ${numero} de ${total}.`}
    >
      <div className="space-y-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() => excluir("uma")}
          className="pressionavel w-full rounded-xl border border-border p-4 text-left hover:bg-surface-2 disabled:opacity-50"
        >
          <p className="text-[14px] font-medium text-text">
            Só a parcela {numero}/{total}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            As outras {total - 1} continuam no extrato e na fatura.
          </p>
        </button>

        <button
          type="button"
          disabled={pendente}
          // `so-recuo`: esta e' a opcao destrutiva e o vermelho e' o aviso.
          // Trocar o fundo no toque apagaria justamente o sinal.
          onClick={() => excluir("todas")}
          className="pressionavel-so-recuo w-full rounded-xl border border-expense/40 bg-expense-soft p-4 text-left hover:brightness-[0.97] disabled:opacity-50"
        >
          <p className="text-[14px] font-medium text-expense">A compra inteira</p>
          <p className="mt-0.5 text-[12.5px] text-expense/80">
            Apaga as {total} parcelas de uma vez. Não tem volta.
          </p>
        </button>

        {erro && (
          <p role="alert" className="pt-1 text-[12.5px] leading-snug text-expense">
            {erro}
          </p>
        )}

        {pendente && (
          <p className="flex items-center justify-center gap-2 pt-1 text-[12.5px] text-muted">
            <Carregando size={15} rotulo={null} />
            Excluindo...
          </p>
        )}
      </div>
    </Modal>
  );
}
