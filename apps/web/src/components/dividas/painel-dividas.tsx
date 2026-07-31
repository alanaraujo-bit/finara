"use client";

import { CheckIcon, PlusIcon, SpinnerGapIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { criarDivida, pagarParcela, type EstadoDivida } from "@/app/(app)/dividas/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SegmentedField, Select } from "@/components/ui/select";
import { formatMoney, parseMoney } from "@/lib/money";

export function FormDivida({
  dataPadrao,
  temParceiro,
}: {
  dataPadrao: string;
  temParceiro: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [titularidade, setTitularidade] = useState("conjunto");
  const [total, setTotal] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [estado, acao, pendente] = useActionState<EstadoDivida, FormData>(criarDivida, {});

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
        Nova dívida
      </Button>
    );
  }

  // Previa do valor da parcela: ver "12x de R$ 250,00" antes de salvar evita
  // o erro de digitar o valor da parcela no lugar do total.
  const centavos = parseMoney(total);
  const n = Math.max(1, Number(parcelas) || 1);
  const porParcela = centavos > 0 ? Math.floor(centavos / n) : 0;

  return (
    <div className="animate-[fade-up_0.35s_var(--ease-out-quint)_both] rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Nova dívida</h3>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nome">O que é</Label>
            <Input
              id="nome"
              name="nome"
              placeholder="Financiamento do carro"
              autoComplete="off"
              disabled={pendente}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="credor">Para quem devo</Label>
            <Input
              id="credor"
              name="credor"
              placeholder="Banco, loja, pessoa..."
              autoComplete="off"
              disabled={pendente}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="total">Valor total</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
                R$
              </span>
              <Input
                id="total"
                name="total"
                inputMode="decimal"
                placeholder="0,00"
                className="tabular pl-11"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                disabled={pendente}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="parcelas">Parcelas</Label>
            <Input
              id="parcelas"
              name="parcelas"
              inputMode="numeric"
              className="tabular"
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              disabled={pendente}
              required
            />
          </div>
        </div>

        {porParcela > 0 && (
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted">
            <span className="tabular font-medium text-text">
              {n}x de {formatMoney(porParcela)}
            </span>{" "}
            — a diferença de centavos vai na última parcela.
          </p>
        )}

        <div>
          <Label htmlFor="primeiroVencimento">Primeiro vencimento</Label>
          <Input
            id="primeiroVencimento"
            name="primeiroVencimento"
            type="date"
            defaultValue={dataPadrao}
            disabled={pendente}
            required
          />
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
            "Criar dívida"
          )}
        </Button>
      </form>
    </div>
  );
}

export function BotaoPagarParcela({
  parcelaId,
  valor,
  contas,
}: {
  parcelaId: string;
  valor: number;
  contas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [contaId, setContaId] = useState("");
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        Pagar
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        aria-label="Conta de onde sai o pagamento"
        value={contaId}
        onChange={(e) => setContaId(e.target.value)}
        disabled={pendente}
        className="h-8 w-auto min-w-[150px] text-[12.5px]"
      >
        <option value="">Sem conta</option>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            await pagarParcela(parcelaId, contaId || undefined);
            setAberto(false);
            router.refresh();
          })
        }
      >
        {pendente ? (
          <SpinnerGapIcon size={14} className="animate-spin" />
        ) : (
          <CheckIcon size={14} weight="bold" />
        )}
        {formatMoney(valor)}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setAberto(false)}>
        Cancelar
      </Button>
    </div>
  );
}
