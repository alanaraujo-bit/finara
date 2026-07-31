"use client";

import { PlusIcon, SpinnerGapIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { criarConta, type EstadoConta } from "@/app/(app)/contas/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SegmentedField, Select } from "@/components/ui/select";

const TIPOS = [
  { valor: "checking", rotulo: "Conta corrente" },
  { valor: "savings", rotulo: "Poupança" },
  { valor: "wallet", rotulo: "Carteira digital" },
  { valor: "cash", rotulo: "Dinheiro em espécie" },
  { valor: "investment", rotulo: "Investimentos" },
  { valor: "other", rotulo: "Outro" },
];

export function FormConta({ temParceiro }: { temParceiro: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [titularidade, setTitularidade] = useState("conjunta");
  const [estado, acao, pendente] = useActionState<EstadoConta, FormData>(criarConta, {});

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
        Nova conta
      </Button>
    );
  }

  return (
    <div className="animate-[fade-up_0.35s_var(--ease-out-quint)_both] rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Nova conta</h3>
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
        <div>
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            name="nome"
            placeholder="Nubank, Itaú, carteira..."
            autoComplete="off"
            disabled={pendente}
            required
            autoFocus
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Select id="tipo" name="tipo" defaultValue="checking" disabled={pendente}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="saldoInicial">Saldo atual</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
                R$
              </span>
              <Input
                id="saldoInicial"
                name="saldoInicial"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue="0,00"
                className="tabular pl-11"
                disabled={pendente}
              />
            </div>
          </div>
        </div>

        {temParceiro && (
          <div>
            <Label>Titularidade</Label>
            <SegmentedField
              name="titularidade"
              valor={titularidade}
              aoMudar={setTitularidade}
              disabled={pendente}
              opcoes={[
                { valor: "conjunta", rotulo: "Conjunta" },
                { valor: "minha", rotulo: "Só minha" },
              ]}
            />
          </div>
        )}
        {!temParceiro && <input type="hidden" name="titularidade" value="conjunta" />}

        <FieldError>{estado.erro}</FieldError>

        <div className="flex gap-2">
          <Button type="submit" size="md" disabled={pendente} className="flex-1">
            {pendente ? (
              <>
                <SpinnerGapIcon size={16} className="animate-spin" />
                Criando...
              </>
            ) : (
              "Criar conta"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
