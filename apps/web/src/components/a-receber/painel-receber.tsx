"use client";

import { CheckIcon, PlusIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { criarRecebivel, receber, type EstadoReceber } from "@/app/(app)/a-receber/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SegmentedField, Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";

export function FormRecebivel({ temParceiro }: { temParceiro: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [instancia, setInstancia] = useState(0);

  return (
    <>
      <Button
        size="md"
        className="gap-1.5"
        onClick={() => {
          setInstancia((n) => n + 1);
          setAberto(true);
        }}
      >
        <PlusIcon size={16} weight="bold" />
        Novo recebível
      </Button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo recebível"
        descricao="Dinheiro que ainda vai entrar."
      >
        <CamposRecebivel
          key={instancia}
          temParceiro={temParceiro}
          aoConcluir={() => setAberto(false)}
        />
      </Modal>
    </>
  );
}

function CamposRecebivel({
  temParceiro,
  aoConcluir,
}: {
  temParceiro: boolean;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [titularidade, setTitularidade] = useState("conjunto");

  const [estado, acao, pendente] = useActionState<EstadoReceber, FormData>(
    async (anterior, form) => {
      const resultado = await criarRecebivel(anterior, form);
      if (resultado.ok) {
        aoConcluir();
        router.refresh();
      }
      return resultado;
    },
    {},
  );

  return (
    <form action={acao} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nome">O que é</Label>
            <Input
              id="nome"
              name="nome"
              placeholder="Freela, empréstimo, reembolso..."
              autoComplete="off"
              disabled={pendente}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="devedor">Quem me deve</Label>
            <Input
              id="devedor"
              name="devedor"
              placeholder="Nome da pessoa ou empresa"
              autoComplete="off"
              disabled={pendente}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div>
            <Label htmlFor="vencimento">Previsão (opcional)</Label>
            <Input id="vencimento" name="vencimento" type="date" disabled={pendente} />
          </div>
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
                { valor: "conjunto", rotulo: "Conjunto" },
                { valor: "meu", rotulo: "Só meu" },
              ]}
            />
          </div>
        )}
        {!temParceiro && <input type="hidden" name="titularidade" value="conjunto" />}

      <FieldError>{estado.erro}</FieldError>

      <Button type="submit" size="lg" disabled={pendente} className="w-full">
        {pendente ? (
          <>
            <SpinnerGapIcon size={17} className="animate-spin" />
            Criando...
          </>
        ) : (
          "Criar recebível"
        )}
      </Button>
    </form>
  );
}

export function BotaoReceber({
  id,
  valor,
  contas,
}: {
  id: string;
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
        Recebi
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        aria-label="Conta que recebeu"
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
            await receber(id, contaId || undefined);
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
