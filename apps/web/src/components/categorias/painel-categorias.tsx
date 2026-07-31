"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import {
  arquivarCategoria,
  excluirCategoria,
  restaurarCategoria,
} from "@/app/(app)/categorias/actions";
import { FormCategoria } from "@/components/categorias/form-categoria";
import { IconeCategoria } from "@/components/categorias/icone-categoria";
import type { Acao } from "@/components/ui/acoes-linha";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinhaDeslizante } from "@/components/ui/linha-deslizante";
import type { CategoriaDaTela } from "@/lib/queries/categorias";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PainelCategorias({
  categorias,
  nomeMes,
}: {
  categorias: CategoriaDaTela[];
  nomeMes: string;
}) {
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const ativas = categorias.filter((c) => !c.arquivada);
  const despesas = ativas.filter((c) => c.tipo === "expense");
  const receitas = ativas.filter((c) => c.tipo === "income");
  const arquivadas = categorias.filter((c) => c.arquivada);

  const gastoNoMes = despesas.reduce((acc, c) => acc + c.noMes, 0);
  const emEdicao = categorias.find((c) => c.id === editando);

  return (
    <>
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Categorias</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {ativas.length} {ativas.length === 1 ? "categoria" : "categorias"} ·{" "}
            <span className="tabular font-medium text-text">{formatMoney(gastoNoMes)}</span> em{" "}
            {nomeMes}
          </p>
        </div>
        <Button size="md" className="gap-1.5" onClick={() => setCriando(true)}>
          <PlusIcon size={16} weight="bold" />
          Nova categoria
        </Button>
      </header>

      <FormCategoria aberto={criando} aoFechar={() => setCriando(false)} />

      {/* Uma caixa de edicao para a lista inteira, e nao uma por linha: a
          `key` remonta os campos ao trocar de categoria, e o DOM nao carrega
          40 formularios escondidos. */}
      {emEdicao && (
        <FormCategoria
          key={emEdicao.id}
          aberto
          categoria={{
            id: emEdicao.id,
            nome: emEdicao.nome,
            tipo: emEdicao.tipo,
            cor: emEdicao.cor,
            icone: emEdicao.icone,
            tetoMensal: emEdicao.tetoMensal,
          }}
          aoFechar={() => setEditando(null)}
        />
      )}

      <Grupo
        titulo="Despesas"
        vazio="Nenhuma categoria de despesa."
        itens={despesas}
        aoEditar={setEditando}
        atraso={60}
      />

      <Grupo
        titulo="Receitas"
        vazio="Nenhuma categoria de receita."
        itens={receitas}
        aoEditar={setEditando}
        atraso={120}
      />

      {arquivadas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-subtle">
            Arquivadas
          </h2>
          <Card className="divide-y divide-border">
            {arquivadas.map((c) => (
              <Linha key={c.id} categoria={c} aoEditar={setEditando} />
            ))}
          </Card>
          <p className="mt-2 px-1 text-[12px] text-subtle">
            Categoria arquivada some dos seletores, mas continua nomeando os lançamentos antigos.
          </p>
        </section>
      )}
    </>
  );
}

function Grupo({
  titulo,
  vazio,
  itens,
  aoEditar,
  atraso,
}: {
  titulo: string;
  vazio: string;
  itens: CategoriaDaTela[];
  aoEditar: (id: string | null) => void;
  atraso: number;
}) {
  return (
    <section
      className="mt-8 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <h2 className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wide text-subtle">
        {titulo}
      </h2>

      {itens.length === 0 ? (
        <Card className="px-5 py-6 text-center text-[13px] text-muted">{vazio}</Card>
      ) : (
        <Card className="divide-y divide-border">
          {itens.map((c) => (
            <Linha key={c.id} categoria={c} aoEditar={aoEditar} />
          ))}
        </Card>
      )}
    </section>
  );
}

function Linha({
  categoria: c,
  aoEditar,
}: {
  categoria: CategoriaDaTela;
  aoEditar: (id: string | null) => void;
}) {
  // Percentual do teto, travado em 100 para a barra nao vazar do trilho — o
  // estouro fica evidente pela cor e pelo texto, nao pela largura.
  const usoDoTeto = c.tetoMensal && c.tetoMensal > 0 ? (c.noMes / c.tetoMensal) * 100 : null;
  const estourou = usoDoTeto !== null && usoDoTeto > 100;

  const podeExcluir = !c.padrao && c.lancamentos === 0;

  return (
    <LinhaDeslizante
      as="div"
      acoes={[
        {
          rotulo: "Editar categoria",
          icone: <PencilSimpleIcon size={15} weight="bold" />,
          aoClicar: () => aoEditar(c.id),
        },
        c.arquivada
          ? {
              rotulo: "Restaurar categoria",
              icone: <ArrowCounterClockwiseIcon size={15} weight="bold" />,
              executar: () => restaurarCategoria(c.id),
            }
          : {
              rotulo: "Arquivar categoria",
              icone: <ArchiveIcon size={15} weight="bold" />,
              executar: () => arquivarCategoria(c.id),
            },
        // Excluir só quando a categoria pode mesmo ser excluída (não é padrão
        // e não tem lançamento). Nos outros casos o caminho é arquivar, e a
        // ação ausente evita prometer o que a action vai recusar.
        ...(podeExcluir
          ? [
              {
                rotulo: "Excluir categoria",
                icone: <TrashIcon size={15} weight="bold" />,
                perigo: true,
                confirmar: "Excluir?",
                executar: () => excluirCategoria(c.id),
                removeALinha: true,
              } satisfies Acao,
            ]
          : []),
      ]}
    >
      {/* Sem tinta de hover, pelo mesmo motivo do extrato: o degradê da pílula
          de ações é `--surface`, e um fundo que muda por baixo dela apareceria
          como faixa de cor errada. */}
      <div
        className={cn(
          "flex items-center gap-3.5 bg-surface px-4 py-3 transition-opacity",
          c.arquivada && "opacity-60",
        )}
      >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl"
        style={{ background: `${c.cor}1f`, color: c.cor }}
      >
        <IconeCategoria nome={c.icone} size={19} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-medium text-text">{c.nome}</p>
          {c.padrao && <Badge>Padrão</Badge>}
        </div>

        {usoDoTeto === null ? (
          <p className="mt-0.5 text-[11.5px] text-subtle">
            {c.lancamentos === 0
              ? "Sem lançamentos"
              : `${c.lancamentos} ${c.lancamentos === 1 ? "lançamento" : "lançamentos"}`}
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-[11.5px] text-subtle">
              teto de <span className="tabular">{formatMoney(c.tetoMensal ?? 0)}</span>
              {estourou && (
                <span className="ml-1.5 font-medium text-expense">
                  · passou {formatMoney(c.noMes - (c.tetoMensal ?? 0))}
                </span>
              )}
            </p>
            <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quint)]"
                style={{
                  width: `${Math.min(usoDoTeto, 100)}%`,
                  background: estourou ? "var(--color-expense)" : c.cor,
                }}
              />
            </div>
          </>
        )}
      </div>

      <p
        className={cn(
          "tabular shrink-0 text-[14px] font-semibold",
          c.noMes === 0 ? "text-subtle" : estourou ? "text-expense" : "text-text",
        )}
      >
        {formatMoney(c.noMes)}
      </p>
      </div>
    </LinhaDeslizante>
  );
}
