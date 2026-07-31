"use client";

import {
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SpinnerGapIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  alternarAssinatura,
  cancelarAssinatura,
  criarAssinatura,
  type EstadoAssinatura,
} from "@/app/(app)/assinaturas/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SegmentedField, Select } from "@/components/ui/select";
import { ROTULO_CICLO } from "@/lib/recorrencia";

export function FormAssinatura({
  categorias,
  dataPadrao,
  temParceiro,
}: {
  categorias: { id: string; nome: string }[];
  dataPadrao: string;
  temParceiro: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [titularidade, setTitularidade] = useState("conjunto");
  const [estado, acao, pendente] = useActionState<EstadoAssinatura, FormData>(
    criarAssinatura,
    {},
  );

  useEffect(() => {
    if (estado.ok) {
      setAberto(false);
      router.refresh();
    }
  }, [estado.ok, router]);

  if (!aberto) {
    return (
      <Button size="md" className="gap-1.5" onClick={() => setAberto(true)}>
        <PlusIcon size={16} weight="bold" />
        Nova assinatura
      </Button>
    );
  }

  return (
    <div className="animate-[fade-up_0.35s_var(--ease-out-quint)_both] rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Nova assinatura</h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Cancelar"
          className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-text"
        >
          <XIcon size={16} weight="bold" />
        </button>
      </div>

      <form action={acao} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
          <div>
            <Label htmlFor="nome">Serviço</Label>
            <Input
              id="nome"
              name="nome"
              placeholder="Netflix, Spotify, academia..."
              autoComplete="off"
              disabled={pendente}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="valor">Valor</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
                R$
              </span>
              <Input
                id="valor"
                name="valor"
                inputMode="decimal"
                placeholder="0,00"
                className="tabular pl-11"
                disabled={pendente}
                required
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ciclo">Cobrança</Label>
            <Select id="ciclo" name="ciclo" defaultValue="monthly" disabled={pendente}>
              {Object.entries(ROTULO_CICLO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="inicio">Primeira cobrança</Label>
            <Input
              id="inicio"
              name="inicio"
              type="date"
              defaultValue={dataPadrao}
              disabled={pendente}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="categoriaId">Categoria</Label>
          <Select id="categoriaId" name="categoriaId" defaultValue="" disabled={pendente}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        {temParceiro && (
          <div>
            <Label>De quem é</Label>
            <SegmentedField
              name="titularidade"
              valor={titularidade}
              aoMudar={setTitularidade}
              disabled={pendente}
              opcoes={[
                { valor: "conjunto", rotulo: "Conjunta" },
                { valor: "meu", rotulo: "Só minha" },
              ]}
            />
          </div>
        )}
        {!temParceiro && <input type="hidden" name="titularidade" value="conjunto" />}

        <FieldError>{estado.erro}</FieldError>

        <Button type="submit" size="md" disabled={pendente} className="w-full">
          {pendente ? (
            <>
              <SpinnerGapIcon size={16} className="animate-spin" />
              Criando...
            </>
          ) : (
            "Criar assinatura"
          )}
        </Button>
      </form>
    </div>
  );
}

/** Pausar/retomar e cancelar. Cancelar e' irreversivel, entao confirma. */
export function AcoesAssinatura({ id, ativa }: { id: string; ativa: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] text-muted">Cancelar de vez?</span>
        <Button
          variant="danger"
          size="sm"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              await cancelarAssinatura(id);
              router.refresh();
            })
          }
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
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pendente}
        aria-label={ativa ? "Pausar assinatura" : "Retomar assinatura"}
        onClick={() =>
          iniciar(async () => {
            await alternarAssinatura(id);
            router.refresh();
          })
        }
        className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
      >
        {pendente ? (
          <SpinnerGapIcon size={15} className="animate-spin" />
        ) : ativa ? (
          <PauseIcon size={15} weight="fill" />
        ) : (
          <PlayIcon size={15} weight="fill" />
        )}
      </button>
      <button
        type="button"
        aria-label="Cancelar assinatura"
        onClick={() => setConfirmando(true)}
        className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-expense"
      >
        <XIcon size={15} weight="bold" />
      </button>
    </div>
  );
}
