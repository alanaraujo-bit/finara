"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { criarConta, type EstadoConta } from "@/app/(app)/contas/actions";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
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
  const [aberto, setAberto] = useState(false);
  // Trocar a chave a cada abertura remonta os campos: ninguem reabre a caixa e
  // encontra o erro — ou o texto pela metade — da tentativa anterior.
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
        Nova conta
      </Button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Nova conta"
        descricao="Onde esse dinheiro fica guardado."
      >
        <Campos key={instancia} temParceiro={temParceiro} aoConcluir={() => setAberto(false)} />
      </Modal>
    </>
  );
}

function Campos({ temParceiro, aoConcluir }: { temParceiro: boolean; aoConcluir: () => void }) {
  const router = useRouter();
  const [titularidade, setTitularidade] = useState("conjunta");

  // Fechar dentro da propria acao, e nao num efeito olhando `estado.ok`:
  // efeito que chama setState dispara render em cascata — e' o que a regra
  // react-hooks/set-state-in-effect reclama, com razao.
  const [estado, acao, pendente] = useActionState<EstadoConta, FormData>(
    async (anterior, form) => {
      const resultado = await criarConta(anterior, form);
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

      <Button type="submit" size="lg" disabled={pendente} className="w-full">
        {pendente ? (
          <>
            <Carregando size={17} rotulo={null} />
            Criando...
          </>
        ) : (
          "Criar conta"
        )}
      </Button>
    </form>
  );
}
