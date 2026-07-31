"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusIcon,
  ScalesIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ajustarSaldo,
  arquivarConta,
  criarConta,
  editarConta,
  excluirConta,
  type EstadoConta,
} from "@/app/(app)/contas/actions";
import type { Acao } from "@/components/ui/acoes-linha";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { LinhaDeslizante } from "@/components/ui/linha-deslizante";
import { Modal } from "@/components/ui/modal";
import { SegmentedField, Select } from "@/components/ui/select";
import { formatMoney, formatMoneyBare, parseMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const TIPOS = [
  { valor: "checking", rotulo: "Conta corrente" },
  { valor: "savings", rotulo: "Poupança" },
  { valor: "wallet", rotulo: "Carteira digital" },
  { valor: "cash", rotulo: "Dinheiro em espécie" },
  { valor: "investment", rotulo: "Investimentos" },
  { valor: "other", rotulo: "Outro" },
];

/** O que a caixa de edicao precisa para abrir preenchida. */
export type ContaEditavel = {
  id: string;
  nome: string;
  tipo: string;
  instituicao: string | null;
  titularidade: "conjunta" | "minha";
  saldo: number;
  arquivada: boolean;
  temLancamentos: boolean;
};

export function FormConta({
  temParceiro,
  conta,
  aberto: abertoExterno,
  aoFechar,
}: {
  temParceiro: boolean;
  /** Presente = modo edicao. */
  conta?: ContaEditavel;
  aberto?: boolean;
  aoFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  // Trocar a chave a cada abertura remonta os campos: ninguem reabre a caixa e
  // encontra o erro — ou o texto pela metade — da tentativa anterior.
  const [instancia, setInstancia] = useState(0);

  if (conta) {
    return (
      <Modal
        aberto={Boolean(abertoExterno)}
        aoFechar={aoFechar!}
        titulo="Editar conta"
        descricao="O saldo não muda por aqui — para corrigi-lo, use “Ajustar saldo”."
      >
        <Campos
          key={conta.id}
          temParceiro={temParceiro}
          conta={conta}
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

function Campos({
  temParceiro,
  conta,
  aoConcluir,
}: {
  temParceiro: boolean;
  conta?: ContaEditavel;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [titularidade, setTitularidade] = useState<string>(conta?.titularidade ?? "conjunta");

  // Fechar dentro da propria acao, e nao num efeito olhando `estado.ok`:
  // efeito que chama setState dispara render em cascata — e' o que a regra
  // react-hooks/set-state-in-effect reclama, com razao.
  const [estado, acao, pendente] = useActionState<EstadoConta, FormData>(
    async (anterior, form) => {
      const resultado = await (conta ? editarConta : criarConta)(anterior, form);
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
      {conta && <input type="hidden" name="id" value={conta.id} />}
      <div>
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          name="nome"
          defaultValue={conta?.nome ?? ""}
          placeholder="Nubank, Itaú, carteira..."
          autoComplete="off"
          disabled={pendente}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tipo">Tipo</Label>
          <Select
            id="tipo"
            name="tipo"
            defaultValue={conta?.tipo ?? "checking"}
            disabled={pendente}
          >
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </Select>
        </div>

        {/* Saldo só na criação. Depois, ele é a soma do que o extrato
            explica, e sobrescrever o número faria o saldo deixar de bater com
            os lançamentos sem deixar rastro. Corrigir é por "Ajustar saldo",
            que registra a diferença como lançamento. */}
        {!conta && (
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
        )}

        {conta && (
          <div>
            <Label htmlFor="instituicao">Instituição</Label>
            <Input
              id="instituicao"
              name="instituicao"
              defaultValue={conta.instituicao ?? ""}
              placeholder="Nubank, Itaú..."
              autoComplete="off"
              disabled={pendente}
            />
          </div>
        )}
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

/**
 * A LINHA de uma conta — o cartão inteiro responde ao gesto.
 *
 * Ajustar saldo sai da fileira e vira o arrasto para a direita: é a ação que
 * se repete (conferir com o extrato do banco toda semana), e a única aqui que
 * não é manutenção de cadastro. As de manutenção ficam na esquerda.
 *
 * Excluir só é oferecido quando nenhum lançamento aponta para a conta. As FKs
 * são `SET NULL`: apagar uma conta com movimento não daria erro, só soltaria
 * os lançamentos em silêncio e o extrato passaria a mostrar gastos sem origem.
 */
export function LinhaConta({
  conta,
  temParceiro,
  children,
  className,
  style,
}: {
  conta: ContaEditavel;
  temParceiro: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [editando, setEditando] = useState(false);
  const [ajustando, setAjustando] = useState(false);

  return (
    <LinhaDeslizante
      as="li"
      className={cn("rounded-2xl", className)}
      style={style}
      acaoPrincipal={{
        rotulo: "Ajustar saldo",
        icone: <ScalesIcon size={15} weight="bold" />,
        tom: "primary",
        aoClicar: () => setAjustando(true),
      }}
      acoes={[
        {
          rotulo: "Editar conta",
          icone: <PencilSimpleIcon size={15} weight="bold" />,
          aoClicar: () => setEditando(true),
        },
        conta.arquivada
          ? {
              rotulo: "Restaurar conta",
              icone: <ArrowCounterClockwiseIcon size={15} weight="bold" />,
              executar: () => arquivarConta(conta.id, false),
            }
          : {
              rotulo: "Arquivar conta",
              icone: <ArchiveIcon size={15} weight="bold" />,
              confirmar: "Arquivar?",
              executar: () => arquivarConta(conta.id, true),
            },
        ...(conta.temLancamentos
          ? []
          : [
              {
                rotulo: "Excluir conta",
                icone: <TrashIcon size={15} weight="bold" />,
                perigo: true,
                confirmar: "Excluir?",
                executar: () => excluirConta(conta.id),
                removeALinha: true,
              } satisfies Acao,
            ]),
      ]}
    >
      <FormConta
        temParceiro={temParceiro}
        conta={conta}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      <AjusteDeSaldo conta={conta} aberto={ajustando} aoFechar={() => setAjustando(false)} />
      {children}
    </LinhaDeslizante>
  );
}

/**
 * Corrige o saldo criando um lançamento com a DIFERENÇA.
 *
 * A pessoa digita o saldo que o banco mostra; o app calcula quanto falta e
 * registra "Ajuste de saldo" no extrato. Assim o número continua sendo
 * explicado pelos lançamentos, e daqui a seis meses ainda dá pra saber por
 * que ele mudou.
 */
function AjusteDeSaldo({
  conta,
  aberto,
  aoFechar,
}: {
  conta: ContaEditavel;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [saldoReal, setSaldoReal] = useState(formatMoneyBare(conta.saldo));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const diferenca = parseMoney(saldoReal) - conta.saldo;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Ajustar saldo"
      descricao={`Saldo atual no Finara: ${formatMoney(conta.saldo)}.`}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor={`saldo-real-${conta.id}`}>Saldo real (o que o banco mostra)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
              R$
            </span>
            <Input
              id={`saldo-real-${conta.id}`}
              inputMode="decimal"
              className="tabular pl-11 text-[17px] font-semibold"
              value={saldoReal}
              onChange={(e) => setSaldoReal(e.target.value)}
              disabled={pendente}
            />
          </div>
        </div>

        <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
          {diferenca === 0 ? (
            "O saldo já é esse — nada a ajustar."
          ) : (
            <>
              Vai entrar no extrato um lançamento de{" "}
              <span className="tabular font-medium text-text">
                {diferenca > 0 ? "+" : "−"}
                {formatMoney(Math.abs(diferenca))}
              </span>{" "}
              chamado “Ajuste de saldo”. O saldo continua explicado pelos lançamentos, em vez de
              mudar sozinho.
            </>
          )}
        </p>

        <FieldError>{erro}</FieldError>

        <Button
          size="lg"
          className="w-full"
          disabled={pendente || diferenca === 0}
          onClick={() =>
            iniciar(async () => {
              const r = await ajustarSaldo(conta.id, saldoReal);
              if (r?.erro) {
                setErro(r.erro);
                return;
              }
              aoFechar();
              router.refresh();
            })
          }
        >
          {pendente ? (
            <>
              <Carregando size={17} rotulo={null} />
              Ajustando...
            </>
          ) : (
            "Registrar ajuste"
          )}
        </Button>
      </div>
    </Modal>
  );
}
