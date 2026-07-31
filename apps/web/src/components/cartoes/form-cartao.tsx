"use client";

import { PlusIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { criarCartao, type EstadoCartao } from "@/app/(app)/cartoes/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
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
        Novo cartão
      </Button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Novo cartão"
        descricao="O ciclo da fatura sai do dia de fechamento."
      >
        <Campos
          key={instancia}
          contas={contas}
          temParceiro={temParceiro}
          aoConcluir={() => setAberto(false)}
        />
      </Modal>
    </>
  );
}

function Campos({
  contas,
  temParceiro,
  aoConcluir,
}: {
  contas: { id: string; nome: string }[];
  temParceiro: boolean;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [titularidade, setTitularidade] = useState("conjunto");
  const [fechamento, setFechamento] = useState("28");
  const [vencimento, setVencimento] = useState("7");
  // Enquanto o usuario nao escolher o vencimento na mao, ele acompanha o
  // fechamento — na maioria dos cartoes a distancia e' de uma semana a dez
  // dias, e adivinhar certo poupa uma pergunta.
  const [vencimentoManual, setVencimentoManual] = useState(false);

  function mudarFechamento(dia: string) {
    setFechamento(dia);
    if (!vencimentoManual) setVencimento(String(((Number(dia) + 9) % 31) + 1));
  }

  const [estado, acao, pendente] = useActionState<EstadoCartao, FormData>(
    async (anterior, form) => {
      const resultado = await criarCartao(anterior, form);
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
          <Select
            id="diaFechamento"
            name="diaFechamento"
            value={fechamento}
            onChange={(e) => mudarFechamento(e.target.value)}
            disabled={pendente}
          >
            {DIAS.map((d) => (
              <option key={d} value={d}>
                Dia {d}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="diaVencimento">Dia do vencimento</Label>
          <Select
            id="diaVencimento"
            name="diaVencimento"
            value={vencimento}
            onChange={(e) => {
              setVencimentoManual(true);
              setVencimento(e.target.value);
            }}
            disabled={pendente}
          >
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
        entram na fatura do mês seguinte. Se o vencimento for antes do fechamento no calendário, ele
        cai no mês seguinte automaticamente.
      </p>

      <div>
        <Label htmlFor="contaPagamentoId">Conta que paga a fatura</Label>
        <Select id="contaPagamentoId" name="contaPagamentoId" defaultValue="" disabled={pendente}>
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

      <Button type="submit" size="lg" disabled={pendente} className="w-full">
        {pendente ? (
          <>
            <SpinnerGapIcon size={17} className="animate-spin" />
            Criando...
          </>
        ) : (
          "Criar cartão"
        )}
      </Button>
    </form>
  );
}
