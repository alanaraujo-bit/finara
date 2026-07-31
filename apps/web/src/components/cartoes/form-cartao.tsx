"use client";

import { PlusIcon, SpinnerGapIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { criarCartao, type EstadoCartao } from "@/app/(app)/cartoes/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SegmentedField, Select } from "@/components/ui/select";

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"];
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

export function FormCartao({
  contas,
  temParceiro,
}: {
  contas: { id: string; nome: string }[];
  temParceiro: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [titularidade, setTitularidade] = useState("conjunto");
  const [estado, acao, pendente] = useActionState<EstadoCartao, FormData>(criarCartao, {});

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
        Novo cartão
      </Button>
    );
  }

  return (
    <div className="animate-[fade-up_0.35s_var(--ease-out-quint)_both] rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Novo cartão</h3>
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
        <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              name="nome"
              placeholder="Nubank, Inter Gold..."
              autoComplete="off"
              disabled={pendente}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="final">Final (opcional)</Label>
            <Input
              id="final"
              name="final"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              className="tabular"
              disabled={pendente}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bandeira">Bandeira</Label>
            <Select id="bandeira" name="bandeira" defaultValue="" disabled={pendente}>
              <option value="">Não informar</option>
              {BANDEIRAS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="limite">Limite</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
                R$
              </span>
              <Input
                id="limite"
                name="limite"
                inputMode="decimal"
                placeholder="0,00"
                defaultValue="0,00"
                className="tabular pl-11"
                disabled={pendente}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="diaFechamento">Dia do fechamento</Label>
            <Select id="diaFechamento" name="diaFechamento" defaultValue="28" disabled={pendente}>
              {DIAS.map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="diaVencimento">Dia do vencimento</Label>
            <Select id="diaVencimento" name="diaVencimento" defaultValue="5" disabled={pendente}>
              {DIAS.map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          Compras feitas <strong className="font-medium text-text">após</strong> o fechamento já
          entram na fatura do mês seguinte. Se o vencimento for antes do fechamento no calendário,
          ele cai no mês seguinte automaticamente.
        </p>

        <div>
          <Label htmlFor="contaPagamentoId">Conta que paga a fatura</Label>
          <Select
            id="contaPagamentoId"
            name="contaPagamentoId"
            defaultValue=""
            disabled={pendente}
          >
            <option value="">Não definir agora</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
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
                { valor: "conjunto", rotulo: "Conjunto" },
                { valor: "meu", rotulo: "Só meu" },
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
            "Criar cartão"
          )}
        </Button>
      </form>
    </div>
  );
}
