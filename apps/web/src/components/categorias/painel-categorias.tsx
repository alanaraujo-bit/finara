"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  arquivarCategoria,
  excluirCategoria,
  restaurarCategoria,
} from "@/app/(app)/categorias/actions";
import { FormCategoria } from "@/components/categorias/form-categoria";
import { IconeCategoria } from "@/components/categorias/icone-categoria";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carregando } from "@/components/ui/carregando";
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

  return (
    <div
      className={cn(
        "group flex items-center gap-3.5 px-4 py-3 transition-colors",
        c.arquivada ? "opacity-60" : "hover:bg-surface-2/60",
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

      <Acoes categoria={c} aoEditar={() => aoEditar(c.id)} />
    </div>
  );
}

/**
 * Editar, arquivar/restaurar e excluir. Excluir so' aparece quando a categoria
 * pode mesmo ser excluida (nao e' padrao e nao tem lancamento); nos outros
 * casos o caminho e' arquivar, e o botao ausente evita prometer o que a action
 * vai recusar.
 */
function Acoes({ categoria: c, aoEditar }: { categoria: CategoriaDaTela; aoEditar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeExcluir = !c.padrao && c.lancamentos === 0;

  function executar(acao: () => Promise<{ erro?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (r?.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  if (erro) {
    return (
      <div className="flex max-w-[240px] items-center gap-2">
        <p role="alert" className="text-right text-[11.5px] leading-snug text-expense">
          {erro}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setErro(null)}>
          Ok
        </Button>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] text-muted">Excluir?</span>
        <Button
          variant="danger"
          size="sm"
          disabled={pendente}
          onClick={() => executar(() => excluirCategoria(c.id))}
        >
          Sim
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
          Não
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 transition-opacity duration-200",
        // No celular nao ha' hover: os botoes ficam sempre visiveis.
        "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100",
      )}
    >
      {pendente ? (
        <span className="grid size-8 place-items-center text-subtle">
          <Carregando size={15} rotulo={null} />
        </span>
      ) : (
        <>
          <BotaoIcone rotulo="Editar categoria" onClick={aoEditar}>
            <PencilSimpleIcon size={15} weight="bold" />
          </BotaoIcone>

          {c.arquivada ? (
            <BotaoIcone
              rotulo="Restaurar categoria"
              onClick={() => executar(() => restaurarCategoria(c.id))}
            >
              <ArrowCounterClockwiseIcon size={15} weight="bold" />
            </BotaoIcone>
          ) : (
            <BotaoIcone
              rotulo="Arquivar categoria"
              onClick={() => executar(() => arquivarCategoria(c.id))}
            >
              <ArchiveIcon size={15} weight="bold" />
            </BotaoIcone>
          )}

          {podeExcluir && (
            <BotaoIcone rotulo="Excluir categoria" perigo onClick={() => setConfirmando(true)}>
              <TrashIcon size={15} weight="bold" />
            </BotaoIcone>
          )}
        </>
      )}
    </div>
  );
}

function BotaoIcone({
  rotulo,
  onClick,
  perigo,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  perigo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-subtle transition-colors",
        perigo ? "hover:bg-surface-2 hover:text-expense" : "hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
