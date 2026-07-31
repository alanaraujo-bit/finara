"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
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
  arquivarDivida,
  criarDivida,
  desfazerPagamentoParcela,
  editarDivida,
  excluirDivida,
  pagarParcela,
  type EstadoDivida,
} from "@/app/(app)/dividas/actions";
import { AcoesLinha, type Acao } from "@/components/ui/acoes-linha";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { LinhaDeslizante } from "@/components/ui/linha-deslizante";
import { Modal } from "@/components/ui/modal";
import { SegmentedField, Select } from "@/components/ui/select";
import { mesmoDiaNoMes, mesPorExtenso } from "@/lib/datas";
import { formatMoney, formatMoneyBare, parseMoney } from "@/lib/money";
import { TATO, vibrar } from "@/lib/tato";
import { cn } from "@/lib/utils";

/** O que o formulario de edicao precisa para abrir preenchido. */
export type DividaEditavel = {
  id: string;
  nome: string;
  credor: string | null;
  parcelasTotal: number;
  parcelasPagas: number;
  valorParcela: number;
  proximoVencimento: string;
  titularidade: "conjunto" | "meu";
};


export function FormDivida({
  dataPadrao,
  temParceiro,
  divida,
  aberto: abertoExterno,
  aoFechar,
}: {
  dataPadrao: string;
  temParceiro: boolean;
  /** Presente = modo edicao, aberto por quem lista. */
  divida?: DividaEditavel;
  aberto?: boolean;
  aoFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [instancia, setInstancia] = useState(0);

  if (divida) {
    return (
      <Modal
        aberto={Boolean(abertoExterno)}
        aoFechar={aoFechar!}
        titulo="Editar dívida"
        descricao="O novo valor e o novo prazo valem das parcelas ainda não pagas em diante."
      >
        <CamposDivida
          key={divida.id}
          dataPadrao={dataPadrao}
          temParceiro={temParceiro}
          divida={divida}
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
        Nova dívida
      </Button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Nova dívida"
        descricao="Diga o que você sabe de cabeça — o resto é calculado."
      >
        <CamposDivida
          key={instancia}
          dataPadrao={dataPadrao}
          temParceiro={temParceiro}
          aoConcluir={() => setAberto(false)}
        />
      </Modal>
    </>
  );
}

function CamposDivida({
  dataPadrao,
  temParceiro,
  divida,
  aoConcluir,
}: {
  dataPadrao: string;
  temParceiro: boolean;
  divida?: DividaEditavel;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const editando = Boolean(divida);
  const [titularidade, setTitularidade] = useState<string>(divida?.titularidade ?? "conjunto");
  const [parcelasTotal, setParcelasTotal] = useState(
    divida ? String(divida.parcelasTotal) : "",
  );
  // Na edicao, "quantas ja' pagou" nao e' editavel: cada parcela paga gerou
  // um lancamento no extrato, e mudar a contagem por aqui desencontraria os
  // dois. Fica so' como leitura, e o campo vai fixo para o calculo.
  const [parcelasPagas, setParcelasPagas] = useState(
    divida ? String(divida.parcelasPagas) : "0",
  );
  const [valorParcela, setValorParcela] = useState(
    divida ? formatMoneyBare(divida.valorParcela) : "",
  );
  const [proximoVencimento, setProximoVencimento] = useState(
    divida?.proximoVencimento ?? dataPadrao,
  );

  const [estado, acao, pendente] = useActionState<EstadoDivida, FormData>(
    async (anterior, form) => {
      const resultado = await (editando ? editarDivida : criarDivida)(anterior, form);
      if (resultado.ok) {
        aoConcluir();
        router.refresh();
      }
      return resultado;
    },
    {},
  );

  const conta = calcularDivida({ parcelasTotal, parcelasPagas, valorParcela, proximoVencimento });

  return (
    <form action={acao} className="space-y-4">
      {divida && <input type="hidden" name="id" value={divida.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nome">O que é</Label>
          <Input
            id="nome"
            name="nome"
            defaultValue={divida?.nome ?? ""}
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
            defaultValue={divida?.credor ?? ""}
            placeholder="Banco, loja, pessoa..."
            autoComplete="off"
            disabled={pendente}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="parcelasTotal">Parcelas ao todo</Label>
          <Input
            id="parcelasTotal"
            name="parcelasTotal"
            inputMode="numeric"
            placeholder="24"
            className="tabular"
            value={parcelasTotal}
            onChange={(e) => setParcelasTotal(e.target.value)}
            disabled={pendente}
            required
          />
        </div>
        <div>
          <Label htmlFor="parcelasPagas">Já paguei</Label>
          <Input
            id="parcelasPagas"
            name="parcelasPagas"
            inputMode="numeric"
            placeholder="0"
            className="tabular"
            value={parcelasPagas}
            onChange={(e) => setParcelasPagas(e.target.value)}
            // Na edição só leitura: cada parcela paga gerou um lançamento no
            // extrato, e mudar a contagem por aqui desencontraria os dois. Para
            // corrigir, o caminho é desfazer o pagamento da parcela.
            readOnly={editando}
            disabled={pendente}
          />
          {editando && (
            <p className="mt-1.5 text-[11.5px] text-subtle">
              Para mudar isto, desfaça o pagamento da parcela na lista.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="valorParcela">Valor da parcela</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
              R$
            </span>
            <Input
              id="valorParcela"
              name="valorParcela"
              inputMode="decimal"
              placeholder="0,00"
              className="tabular pl-11"
              value={valorParcela}
              onChange={(e) => setValorParcela(e.target.value)}
              disabled={pendente}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="proximoVencimento">Próxima vence em</Label>
          <Input
            id="proximoVencimento"
            name="proximoVencimento"
            type="date"
            value={proximoVencimento}
            onChange={(e) => setProximoVencimento(e.target.value)}
            disabled={pendente}
            required
          />
        </div>
      </div>

      {conta && <ResumoDivida conta={conta} />}

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

      <Button type="submit" size="lg" disabled={pendente} className="w-full">
        {pendente ? (
          <>
            <Carregando size={17} rotulo={null} />
            Criando...
          </>
        ) : (
          "Criar dívida"
        )}
      </Button>
    </form>
  );
}

type ContaDaDivida = {
  total: number;
  pago: number;
  falta: number;
  pagas: number;
  restantes: number;
  percentual: number;
  termina: string;
};

/**
 * A mesma aritmetica que a server action faz — aqui so' para o usuario ver o
 * numero enquanto digita. Quem grava e' o servidor; isto e' previa.
 */
function calcularDivida(entrada: {
  parcelasTotal: string;
  parcelasPagas: string;
  valorParcela: string;
  proximoVencimento: string;
}): ContaDaDivida | null {
  const total = Number(entrada.parcelasTotal);
  const pagas = Number(entrada.parcelasPagas || "0");
  const parcela = parseMoney(entrada.valorParcela);

  const valido =
    Number.isInteger(total) &&
    total > 0 &&
    Number.isInteger(pagas) &&
    pagas >= 0 &&
    pagas < total &&
    parcela > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(entrada.proximoVencimento);

  if (!valido) return null;

  const restantes = total - pagas;

  return {
    total: parcela * total,
    pago: parcela * pagas,
    falta: parcela * restantes,
    pagas,
    restantes,
    percentual: (pagas / total) * 100,
    // A ultima parcela cai `restantes - 1` meses depois da proxima.
    termina: mesPorExtenso(mesmoDiaNoMes(entrada.proximoVencimento, restantes - 1)),
  };
}

function ResumoDivida({ conta }: { conta: ContaDaDivida }) {
  return (
    <div className="animate-[fade-in_0.25s_ease-out] rounded-xl border border-border bg-surface-2/60 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium uppercase tracking-wide text-subtle">
          Falta pagar
        </span>
        <span className="tabular text-[19px] font-semibold text-text">
          {formatMoney(conta.falta)}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-income transition-[width] duration-500 ease-[var(--ease-out-quint)]"
          style={{ width: `${conta.percentual}%` }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12.5px]">
        <dt className="text-muted">Total da dívida</dt>
        <dd className="tabular text-right font-medium text-text">{formatMoney(conta.total)}</dd>

        <dt className="text-muted">Já pago{conta.pagas > 0 ? ` (${conta.pagas}x)` : ""}</dt>
        <dd className="tabular text-right font-medium text-income">{formatMoney(conta.pago)}</dd>

        <dt className="text-muted">Faltam</dt>
        <dd className="text-right font-medium text-text">
          {conta.restantes}
          {conta.restantes === 1 ? " parcela" : " parcelas"}
        </dd>

        <dt className="text-muted">Última em</dt>
        <dd className="text-right font-medium text-text">{conta.termina}</dd>
      </dl>
    </div>
  );
}

/**
 * A folha de pagar uma parcela.
 *
 * Mesma história do recebível: o seletor de conta abria dentro da linha e
 * reorganizava o cartão da dívida no exato momento de conferir o valor. Como
 * folha, a pergunta ("de onde sai?") tem espaço, e o valor da parcela aparece
 * grande antes de confirmar.
 */
export function FolhaPagarParcela({
  parcelaId,
  numero,
  valor,
  contas,
  aoFechar,
}: {
  parcelaId: string;
  numero: number;
  valor: number;
  contas: { id: string; nome: string }[];
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [contaId, setContaId] = useState("");
  const [pendente, iniciar] = useTransition();

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={`Pagar a parcela ${numero}`}
      descricao="Vira um lançamento no extrato e sai do saldo da conta escolhida."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-2/60 p-4 text-center">
          <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">Valor</p>
          <p className="tabular mt-1 text-[30px] font-semibold leading-none text-text">
            {formatMoney(valor)}
          </p>
        </div>

        <div>
          <Label htmlFor={`conta-parcela-${parcelaId}`}>De onde sai?</Label>
          <Select
            id={`conta-parcela-${parcelaId}`}
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            disabled={pendente}
          >
            <option value="">Sem conta (não mexer em saldo)</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>

        <Button
          size="lg"
          className="w-full gap-2"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              await pagarParcela(parcelaId, contaId || undefined);
              vibrar(TATO.concluido);
              aoFechar();
              router.refresh();
            })
          }
        >
          {pendente ? (
            <>
              <Carregando size={17} rotulo={null} />
              Pagando...
            </>
          ) : (
            <>
              <CheckIcon size={16} weight="bold" />
              Confirmar pagamento
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Acoes da divida: editar, arquivar e excluir.
 *
 * Excluir so' e' oferecido quando nenhuma parcela foi paga. Com pagamento no
 * historico a action recusa — e oferecer um botao que sera' recusado e' pior
 * do que nao oferecer. Nesse caso sobra arquivar, que tira das listas sem
 * apagar os lancamentos que a divida ja' explicou.
 */
export function LinhaDivida({
  divida,
  dataPadrao,
  temParceiro,
  parcelaAberta,
  contas,
  children,
  className,
  style,
}: {
  divida: DividaEditavel;
  dataPadrao: string;
  temParceiro: boolean;
  /** A próxima parcela em aberto, quando existe: é ela que o gesto paga. */
  parcelaAberta?: { id: string; numero: number; valor: number };
  contas: { id: string; nome: string }[];
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [editando, setEditando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const semHistorico = divida.parcelasPagas === 0;

  return (
    <LinhaDeslizante
      as="li"
      className={cn("rounded-2xl", className)}
      style={style}
      // Pagar a próxima parcela é a ação que se repete todo mês nesta tela —
      // e é reversível (`desfazerPagamentoParcela` existe). Ganha o gesto.
      acaoPrincipal={
        parcelaAberta
          ? {
              rotulo: "Pagar parcela",
              icone: <CheckIcon size={15} weight="bold" />,
              aoClicar: () => setPagando(true),
            }
          : undefined
      }
      acoes={[
        {
          rotulo: "Editar dívida",
          icone: <PencilSimpleIcon size={15} weight="bold" />,
          aoClicar: () => setEditando(true),
        },
        {
          rotulo: "Arquivar dívida",
          icone: <ArchiveIcon size={15} weight="bold" />,
          confirmar: "Arquivar?",
          executar: () => arquivarDivida(divida.id),
        },
        ...(semHistorico
          ? [
              {
                rotulo: "Excluir dívida",
                icone: <TrashIcon size={15} weight="bold" />,
                perigo: true,
                confirmar: "Excluir?",
                executar: () => excluirDivida(divida.id),
              } satisfies Acao,
            ]
          : []),
      ]}
    >
      <FormDivida
        dataPadrao={dataPadrao}
        temParceiro={temParceiro}
        divida={divida}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      {pagando && parcelaAberta && (
        <FolhaPagarParcela
          parcelaId={parcelaAberta.id}
          numero={parcelaAberta.numero}
          valor={parcelaAberta.valor}
          contas={contas}
          aoFechar={() => setPagando(false)}
        />
      )}
      {children}
    </LinhaDeslizante>
  );
}

/**
 * O botão de pagar que continua no bloco da próxima parcela.
 *
 * O gesto de arrastar dá o caminho rápido; este dá o caminho descoberto. Quem
 * nunca arrastou uma linha na vida ainda precisa achar como pagar, e o lugar
 * onde a pessoa procura é ao lado da parcela que está vencendo.
 */
export function BotaoPagarParcela({
  parcelaId,
  numero,
  valor,
  contas,
}: {
  parcelaId: string;
  numero: number;
  valor: number;
  contas: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        Pagar
      </Button>
      {aberto && (
        <FolhaPagarParcela
          parcelaId={parcelaId}
          numero={numero}
          valor={valor}
          contas={contas}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

/**
 * Desfaz o pagamento da parcela mais recente: apaga o lancamento gerado e
 * devolve o valor ao saldo. E' o unico caminho para corrigir uma parcela
 * quitada com valor ou conta errada.
 */
export function BotaoDesfazerParcela({ parcelaId }: { parcelaId: string }) {
  return (
    <AcoesLinha
      acoes={[
        {
          rotulo: "Desfazer pagamento da parcela",
          icone: <ArrowCounterClockwiseIcon size={15} weight="bold" />,
          confirmar: "Desfazer?",
          executar: () => desfazerPagamentoParcela(parcelaId),
        },
      ]}
    />
  );
}
