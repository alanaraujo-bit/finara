"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  criarCategoria,
  editarCategoria,
  type EstadoCategoria,
} from "@/app/(app)/categorias/actions";
import { IconeCategoria } from "@/components/categorias/icone-categoria";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SegmentedField } from "@/components/ui/select";
import { COR_PADRAO, CORES_CATEGORIA, ICONE_PADRAO, ICONES_CATEGORIA } from "@/lib/icones-categoria";
import { formatMoneyBare } from "@/lib/money";
import { cn } from "@/lib/utils";

export type CategoriaEditavel = {
  id: string;
  nome: string;
  tipo: "expense" | "income";
  cor: string;
  icone: string;
  tetoMensal: number | null;
};

/**
 * Formulario de categoria. O mesmo componente cria e edita — os campos sao os
 * mesmos, e duplica-los levaria as duas copias a divergir na primeira mudanca.
 */
export function FormCategoria({
  aberto,
  categoria,
  aoFechar,
}: {
  aberto: boolean;
  categoria?: CategoriaEditavel;
  aoFechar: () => void;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={categoria ? "Editar categoria" : "Nova categoria"}
      descricao={
        categoria ? "Renomear e recolorir vale até para as padrão." : "Como esse gasto se chama."
      }
    >
      <Campos categoria={categoria} aoConcluir={aoFechar} />
    </Modal>
  );
}

function Campos({
  categoria,
  aoConcluir,
}: {
  categoria?: CategoriaEditavel;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const editando = Boolean(categoria);

  const [estado, acao, pendente] = useActionState<EstadoCategoria, FormData>(
    async (anterior, form) => {
      const resultado = await (editando ? editarCategoria : criarCategoria)(anterior, form);
      if (resultado.ok) {
        aoConcluir();
        router.refresh();
      }
      return resultado;
    },
    {},
  );

  const [tipo, setTipo] = useState<string>(categoria?.tipo ?? "expense");
  const [cor, setCor] = useState(categoria?.cor ?? COR_PADRAO);
  const [icone, setIcone] = useState(categoria?.icone ?? ICONE_PADRAO);

  return (
    <form action={acao} className="space-y-4">
        {categoria && <input type="hidden" name="id" value={categoria.id} />}

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor={`nome-${categoria?.id ?? "nova"}`}>Nome</Label>
            <div className="flex items-center gap-2.5">
              {/* Previa: o usuario ve' a combinacao cor + icone enquanto escolhe. */}
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl transition-colors duration-200"
                style={{ background: `${cor}1f`, color: cor }}
              >
                <IconeCategoria nome={icone} size={20} />
              </span>
              <Input
                id={`nome-${categoria?.id ?? "nova"}`}
                name="nome"
                defaultValue={categoria?.nome}
                placeholder="Mercado, pet, faculdade..."
                autoComplete="off"
                maxLength={40}
                disabled={pendente}
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <Label>Tipo</Label>
            <SegmentedField
              name="tipo"
              valor={tipo}
              aoMudar={setTipo}
              disabled={pendente}
              opcoes={[
                { valor: "expense", rotulo: "Despesa", tom: "expense" },
                { valor: "income", rotulo: "Receita", tom: "income" },
              ]}
            />
          </div>
        </div>

        <div>
          <Label>Cor</Label>
          <div className="flex flex-wrap gap-2">
            {CORES_CATEGORIA.map((c) => (
              <button
                key={c}
                type="button"
                disabled={pendente}
                aria-label={`Cor ${c}`}
                aria-pressed={c === cor}
                onClick={() => setCor(c)}
                style={{ background: c }}
                className={cn(
                  "grid size-7 place-items-center rounded-full text-white",
                  "transition-transform duration-200 ease-[var(--ease-out-quint)]",
                  c === cor ? "scale-110" : "hover:scale-105",
                )}
              >
                {c === cor && <CheckIcon size={13} weight="bold" />}
              </button>
            ))}
          </div>
          <input type="hidden" name="cor" value={cor} />
        </div>

        <div>
          <Label>Ícone</Label>
          <div className="grid max-h-[152px] grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5 overflow-y-auto rounded-xl border border-border bg-surface-2 p-2">
            {ICONES_CATEGORIA.map((nome) => {
              const ativo = nome === icone;
              return (
                <button
                  key={nome}
                  type="button"
                  disabled={pendente}
                  aria-label={nome}
                  aria-pressed={ativo}
                  onClick={() => setIcone(nome)}
                  style={ativo ? { background: `${cor}1f`, color: cor } : undefined}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg transition-colors duration-200",
                    ativo ? "shadow-xs" : "text-muted hover:bg-surface hover:text-text",
                  )}
                >
                  <IconeCategoria nome={nome} size={19} weight={ativo ? "duotone" : "regular"} />
                </button>
              );
            })}
          </div>
          <input type="hidden" name="icone" value={icone} />
        </div>

        {/* Teto so' faz sentido em despesa: ninguem limita quanto quer receber. */}
        {tipo === "expense" && (
          <div>
            <Label htmlFor={`teto-${categoria?.id ?? "nova"}`}>Teto mensal (opcional)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
                R$
              </span>
              <Input
                id={`teto-${categoria?.id ?? "nova"}`}
                name="teto"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue={categoria?.tetoMensal ? formatMoneyBare(categoria.tetoMensal) : ""}
                className="tabular pl-11"
                disabled={pendente}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-subtle">
              Quanto pretende gastar por mês aqui. Serve de referência na lista — nada é bloqueado.
            </p>
          </div>
        )}
        {tipo !== "expense" && <input type="hidden" name="teto" value="" />}

      <FieldError>{estado.erro}</FieldError>

      <Button type="submit" size="lg" disabled={pendente} className="w-full">
        {pendente ? (
          <>
            <Carregando size={17} rotulo={null} />
            {editando ? "Salvando..." : "Criando..."}
          </>
        ) : editando ? (
          "Salvar alterações"
        ) : (
          "Criar categoria"
        )}
      </Button>
    </form>
  );
}
