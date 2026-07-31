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
import { useActionState, useState, useTransition } from "react";
import {
  arquivarDivida,
  criarDivida,
  desfazerPagamentoParcela,
  editarDivida,
  excluirDivida,
  pagarParcela,
  type EstadoDivida,
} from "@/app/(app)/dividas/actions";
import { AcoesLinha } from "@/components/ui/acoes-linha";

import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SegmentedField, Select } from "@/components/ui/select";
import { mesmoDiaNoMes, mesPorExtenso } from "@/lib/datas";
import { formatMoney, formatMoneyBare, parseMoney } from "@/lib/money";

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
          <Carregando size={14} rotulo={null} />
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

/**
 * Acoes da divida: editar, arquivar e excluir.
 *
 * Excluir so' e' oferecido quando nenhuma parcela foi paga. Com pagamento no
 * historico a action recusa — e oferecer um botao que sera' recusado e' pior
 * do que nao oferecer. Nesse caso sobra arquivar, que tira das listas sem
 * apagar os lancamentos que a divida ja' explicou.
 */
export function AcoesDivida({
  divida,
  dataPadrao,
  temParceiro,
}: {
  divida: DividaEditavel;
  dataPadrao: string;
  temParceiro: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const semHistorico = divida.parcelasPagas === 0;

  return (
    <>
      <FormDivida
        dataPadrao={dataPadrao}
        temParceiro={temParceiro}
        divida={divida}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      <AcoesLinha
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
                },
              ]
            : []),
        ]}
      />
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
