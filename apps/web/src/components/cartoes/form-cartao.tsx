"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useState, type CSSProperties, type ReactNode } from "react";
import {
  arquivarCartao,
  criarCartao,
  desfazerPagamentoFatura,
  editarCartao,
  excluirCartao,
  type EstadoCartao,
} from "@/app/(app)/cartoes/actions";
import { AcoesLinha, type Acao } from "@/components/ui/acoes-linha";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { LinhaDeslizante } from "@/components/ui/linha-deslizante";
import { Modal } from "@/components/ui/modal";
import { formatMoneyBare } from "@/lib/money";
import { SegmentedField, Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"];
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

/** O que a caixa de edicao precisa para abrir preenchida. */
export type CartaoEditavel = {
  id: string;
  nome: string;
  bandeira: string | null;
  final: string | null;
  limite: number;
  diaFechamento: number;
  diaVencimento: number;
  contaPagamentoId: string | null;
  titularidade: "conjunto" | "meu";
  temCompras: boolean;
};

export function FormCartao({
  contas,
  temParceiro,
  cartao,
  aberto: abertoExterno,
  aoFechar,
}: {
  contas: { id: string; nome: string }[];
  temParceiro: boolean;
  /** Presente = modo edicao. */
  cartao?: CartaoEditavel;
  aberto?: boolean;
  aoFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [instancia, setInstancia] = useState(0);

  if (cartao) {
    return (
      <Modal
        aberto={Boolean(abertoExterno)}
        aoFechar={aoFechar!}
        titulo="Editar cartão"
        descricao="Mudar o dia de fechamento só vale para as compras seguintes."
      >
        <Campos
          key={cartao.id}
          contas={contas}
          temParceiro={temParceiro}
          cartao={cartao}
          aoConcluir={aoFechar!}
        />
      </Modal>
    );
  }

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
  cartao,
  aoConcluir,
}: {
  contas: { id: string; nome: string }[];
  temParceiro: boolean;
  cartao?: CartaoEditavel;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [titularidade, setTitularidade] = useState<string>(cartao?.titularidade ?? "conjunto");
  const [fechamento, setFechamento] = useState(String(cartao?.diaFechamento ?? 28));
  const [vencimento, setVencimento] = useState(String(cartao?.diaVencimento ?? 7));
  // Enquanto o usuario nao escolher o vencimento na mao, ele acompanha o
  // fechamento — na maioria dos cartoes a distancia e' de uma semana a dez
  // dias, e adivinhar certo poupa uma pergunta.
  // Na edicao o vencimento ja e o real do cartao: sugerir de novo a partir
  // do fechamento sobrescreveria o que a pessoa cadastrou.
  const [vencimentoManual, setVencimentoManual] = useState(Boolean(cartao));

  function mudarFechamento(dia: string) {
    setFechamento(dia);
    if (!vencimentoManual) setVencimento(String(((Number(dia) + 9) % 31) + 1));
  }

  const [estado, acao, pendente] = useActionState<EstadoCartao, FormData>(
    async (anterior, form) => {
      const resultado = await (cartao ? editarCartao : criarCartao)(anterior, form);
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
            defaultValue={cartao?.nome ?? ""}
            placeholder="Nubank, Inter Gold..."
            autoComplete="off"
            disabled={pendente}
            required
          />
        </div>
        <div>
          <Label htmlFor="final">Final (opcional)</Label>
          <Input
            id="final"
            name="final"
            defaultValue={cartao?.final ?? ""}
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
          <Select
            id="bandeira"
            name="bandeira"
            defaultValue={cartao?.bandeira ?? ""}
            disabled={pendente}
          >
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
              defaultValue={cartao ? formatMoneyBare(cartao.limite) : "0,00"}
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
        <Select
          id="contaPagamentoId"
          name="contaPagamentoId"
          defaultValue={cartao?.contaPagamentoId ?? ""}
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

      <Button type="submit" size="lg" disabled={pendente} className="w-full">
        {pendente ? (
          <>
            <Carregando size={17} rotulo={null} />
            Criando...
          </>
        ) : (
          "Criar cartão"
        )}
      </Button>
    </form>
  );
}


/**
 * A LINHA de um cartão.
 *
 * Aqui a gaveta serve só a manutenção do cadastro — editar, arquivar,
 * excluir. Pagar a fatura NÃO virou gesto de propósito: é a operação que mais
 * mexe em dinheiro na tela inteira (debita a conta de verdade), acontece uma
 * vez por mês e precisa do valor à vista na hora de decidir. Ação assim merece
 * um botão explícito, no bloco da fatura, onde o número está. Gesto é para o
 * que se repete, não para o que é grave.
 *
 * Excluir só aparece quando nenhuma compra passou pelo cartão —
 * `transactions.cardId` é `SET NULL`, então apagar um cartão com movimento
 * soltaria as compras em silêncio e elas virariam gastos sem origem.
 */
export function LinhaCartao({
  cartao,
  contas,
  temParceiro,
  children,
  className,
  style,
}: {
  cartao: CartaoEditavel;
  contas: { id: string; nome: string }[];
  temParceiro: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <LinhaDeslizante
      as="li"
      className={cn("rounded-2xl", className)}
      style={style}
      acoes={[
        {
          rotulo: "Editar cartão",
          icone: <PencilSimpleIcon size={15} weight="bold" />,
          aoClicar: () => setEditando(true),
        },
        {
          rotulo: "Arquivar cartão",
          icone: <ArchiveIcon size={15} weight="bold" />,
          confirmar: "Arquivar?",
          executar: () => arquivarCartao(cartao.id, true),
        },
        ...(cartao.temCompras
          ? []
          : [
              {
                rotulo: "Excluir cartão",
                icone: <TrashIcon size={15} weight="bold" />,
                perigo: true,
                confirmar: "Excluir?",
                executar: () => excluirCartao(cartao.id),
                removeALinha: true,
              } satisfies Acao,
            ]),
      ]}
    >
      <FormCartao
        contas={contas}
        temParceiro={temParceiro}
        cartao={cartao}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      {children}
    </LinhaDeslizante>
  );
}

/**
 * Desfaz o pagamento da fatura: devolve o valor a' conta e reabre a fatura.
 *
 * E' o que destrava corrigir uma compra que caiu numa fatura ja' quitada.
 * Sem isto, um erro de digitacao de tres meses atras ficaria impossivel de
 * arrumar pela interface.
 */
export function BotaoDesfazerFatura({ faturaId }: { faturaId: string }) {
  return (
    <AcoesLinha
      acoes={[
        {
          rotulo: "Desfazer pagamento da fatura",
          icone: <ArrowCounterClockwiseIcon size={15} weight="bold" />,
          confirmar: "Desfazer?",
          executar: () => desfazerPagamentoFatura(faturaId),
        },
      ]}
    />
  );
}
