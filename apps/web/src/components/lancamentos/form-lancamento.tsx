"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  criarLancamento,
  editarLancamento,
  type EstadoLancamento,
} from "@/app/(app)/lancamentos/actions";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SegmentedField, Select } from "@/components/ui/select";
import { mesmoDiaNoMes, mesPorExtenso } from "@/lib/datas";
import { formatMoney, formatMoneyBare, parseMoney } from "@/lib/money";

type Opcao = { id: string; nome: string; tipo?: string };

/**
 * Espelha a divisao que a server action faz — inclusive a sobra de centavos
 * indo para a primeira parcela. Serve para o usuario ver "12x de R$ 250,00"
 * e em que meses isso cai, antes de salvar.
 */
function dividirParcelas(valor: string, parcelas: string, dataCompra: string) {
  const centavos = parseMoney(valor);
  const quantidade = Number(parcelas);

  if (centavos <= 0 || !Number.isInteger(quantidade) || quantidade < 2) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCompra)) return null;

  const parcela = Math.floor(centavos / quantidade);

  return {
    quantidade,
    parcela,
    sobra: centavos - parcela * quantidade,
    primeiroMes: mesPorExtenso(dataCompra),
    ultimoMes: mesPorExtenso(mesmoDiaNoMes(dataCompra, quantidade - 1)),
  };
}

/** O que o formulario precisa para abrir ja' preenchido numa edicao. */
export type LancamentoEditavel = {
  id: string;
  tipo: "expense" | "income";
  valor: number;
  descricao: string;
  data: string;
  categoriaId: string | null;
  contaId: string | null;
  cartaoId: string | null;
  observacao: string | null;
  titularidade: "conjunto" | "meu";
  parcela: number | null;
  parcelasTotal: number | null;
};

export function FormLancamento({
  contas,
  cartoes,
  categorias,
  dataPadrao,
  temParceiro,
  lancamento,
  aoConcluir,
}: {
  contas: Opcao[];
  cartoes: Opcao[];
  categorias: (Opcao & { tipo: string })[];
  dataPadrao: string;
  temParceiro: boolean;
  /** Presente = modo edicao. */
  lancamento?: LancamentoEditavel;
  /** Chamado quando a edicao conclui — fecha a caixa. */
  aoConcluir?: () => void;
}) {
  const router = useRouter();
  const editando = Boolean(lancamento);

  const [estado, acao, pendente] = useActionState<EstadoLancamento, FormData>(
    async (anterior, form) => {
      if (!editando) return criarLancamento(anterior, form);
      const r = await editarLancamento(anterior, form);
      // Fechar aqui dentro, e nao num efeito que observa `estado.ok`: o
      // efeito com setState dispara render em cascata (e' o que a regra
      // react-hooks/set-state-in-effect acusa).
      if (r.ok) {
        aoConcluir?.();
        router.refresh();
      }
      return r;
    },
    {},
  );

  const origemInicial = lancamento?.contaId
    ? `conta:${lancamento.contaId}`
    : lancamento?.cartaoId
      ? `cartao:${lancamento.cartaoId}`
      : "";

  const [tipo, setTipo] = useState<string>(lancamento?.tipo ?? "expense");
  const [titularidade, setTitularidade] = useState<string>(
    lancamento?.titularidade ?? "conjunto",
  );
  const [origem, setOrigem] = useState(origemInicial);
  const [valor, setValor] = useState(lancamento ? formatMoneyBare(lancamento.valor) : "");
  const [parcelas, setParcelas] = useState("1");
  const [data, setData] = useState(lancamento?.data ?? dataPadrao);
  const [escopo, setEscopo] = useState<"uma" | "daqui" | "todas">("uma");

  // O seletor de alcance so' faz sentido numa compra parcelada com mais de
  // uma parcela a frente — em "12/12" nao ha' "e as proximas".
  const ehParcelada = Boolean(
    editando && lancamento?.parcelasTotal && lancamento.parcelasTotal > 1,
  );
  // Fora do escopo "uma", data e origem seguem individuais em cada parcela:
  // sobrescreve-las em bloco colidiria parcelas no mesmo ciclo de fatura.
  const soEstaParcela = !ehParcelada || escopo === "uma";

  // Parcelar so' faz sentido no cartao: em conta, o dinheiro sai de uma vez.
  const noCartao = origem.startsWith("cartao:");
  const divisao = noCartao ? dividirParcelas(valor, parcelas, data) : null;

  // As categorias sao separadas por natureza: oferecer "Salário" numa despesa
  // so' polui a lista e convida ao erro de classificacao.
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  useEffect(() => {
    // So' na criacao: a edicao acontece numa caixa sobre a propria lista e
    // fecha sozinha dentro da action, sem navegar.
    if (estado.ok && !editando) {
      // Sem `router.refresh()` depois do push: a action ja' chama
      // `revalidatePath("/lancamentos")`, entao o push ja' busca dado fresco.
      // Os dois juntos disputavam o mesmo quadro e a navegacao travava no
      // fallback de `loading.tsx` — a pessoa salvava o lancamento e ficava
      // olhando a tela de espera.
      router.push("/lancamentos");
    }
  }, [estado.ok, editando, router]);

  return (
    <form action={acao} className="space-y-4">
      {lancamento && <input type="hidden" name="id" value={lancamento.id} />}

      {ehParcelada && (
        <div className="rounded-xl border border-border bg-surface-2/60 p-3">
          <p className="text-[12.5px] font-medium text-text">
            Parcela {lancamento!.parcela} de {lancamento!.parcelasTotal}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted">Esta alteração vale para:</p>
          <div className="mt-2 space-y-1.5">
            {(
              [
                ["uma", `Somente esta parcela (${lancamento!.parcela}/${lancamento!.parcelasTotal})`],
                // "Esta e as próximas" some na última parcela: ali ela seria
                // idêntica a "somente esta", e oferecer duas opções que fazem
                // a mesma coisa só faz a pessoa parar pra decidir à toa.
                ...(lancamento!.parcela! < lancamento!.parcelasTotal!
                  ? ([
                      [
                        "daqui",
                        `Esta e as próximas (${lancamento!.parcela} a ${lancamento!.parcelasTotal})`,
                      ],
                    ] as const)
                  : []),
                ["todas", `A compra inteira (1 a ${lancamento!.parcelasTotal})`],
              ] as const
            ).map(([valorOpcao, rotulo]) => (
              <label
                key={valorOpcao}
                className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-text"
              >
                <input
                  type="radio"
                  name="escopo"
                  value={valorOpcao}
                  checked={escopo === valorOpcao}
                  onChange={() => setEscopo(valorOpcao)}
                  disabled={pendente}
                  className="size-3.5 accent-[var(--primary)]"
                />
                {rotulo}
              </label>
            ))}
          </div>
          {!soEstaParcela && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
              Data e origem continuam individuais em cada parcela — cada uma cai na fatura do mês
              dela. O valor informado passa a valer para cada parcela afetada.
            </p>
          )}
        </div>
      )}

      <SegmentedField
        name="tipo"
        valor={tipo}
        aoMudar={setTipo}
        disabled={pendente}
        opcoes={[
          { valor: "expense", rotulo: "Saída", tom: "expense" },
          { valor: "income", rotulo: "Entrada", tom: "income" },
        ]}
      />

      <div>
        <Label htmlFor="valor">Valor</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
            R$
          </span>
          <Input
            id="valor"
            name="valor"
            // inputMode decimal abre o teclado numerico no celular sem
            // bloquear a digitacao de virgula, que o pt-BR usa.
            inputMode="decimal"
            placeholder="0,00"
            autoComplete="off"
            className="tabular pl-11 text-[17px] font-semibold"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={pendente}
            required
            autoFocus
          />
        </div>
      </div>

      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Input
          id="descricao"
          name="descricao"
          defaultValue={lancamento?.descricao ?? ""}
          placeholder="Mercado, aluguel, salário..."
          autoComplete="off"
          disabled={pendente}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* A data some quando a edicao alcanca varias parcelas: cada uma tem
            a sua, e uma data unica em bloco jogaria todas no mesmo mes.
            Continua indo no `form` como hidden porque a action valida o
            campo mesmo quando nao o aplica. */}
        {soEstaParcela ? (
          <div>
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              name="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={pendente}
              required
            />
          </div>
        ) : (
          <input type="hidden" name="data" value={data} />
        )}

        <div>
          <Label htmlFor="categoriaId">Categoria</Label>
          <Select
            id="categoriaId"
            name="categoriaId"
            disabled={pendente}
            defaultValue={lancamento?.categoriaId ?? ""}
          >
            <option value="">Sem categoria</option>
            {categoriasDoTipo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* A origem some pelo mesmo motivo da data: cada parcela ja' esta'
          amarrada a' fatura do ciclo dela, e mover todas de cartao de uma vez
          teria que remontar faturas inteiras. */}
      <div className={soEstaParcela ? undefined : "hidden"}>
        <Label htmlFor="origem">De onde saiu</Label>
        {/* Um campo so' para conta e cartao: como sao mutuamente exclusivos,
            dois selects permitiriam preencher os dois e criar estado invalido. */}
        <Select
          id="origem"
          name="origem"
          disabled={pendente}
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        >
          <option value="">Não vincular (não afeta saldo)</option>
          {contas.length > 0 && (
            <optgroup label="Contas">
              {contas.map((c) => (
                <option key={c.id} value={`conta:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          )}
          {cartoes.length > 0 && tipo === "expense" && (
            <optgroup label="Cartões de crédito">
              {cartoes.map((c) => (
                <option key={c.id} value={`cartao:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          )}
        </Select>

        {contas.length === 0 && cartoes.length === 0 && (
          <p className="mt-1.5 text-[12.5px] text-muted">
            Você ainda não tem contas nem cartões. O lançamento é registrado mesmo assim, mas nenhum
            saldo é movimentado.
          </p>
        )}
        {cartoes.length > 0 && tipo === "expense" && !noCartao && (
          <p className="mt-1.5 text-[12.5px] text-muted">
            Compra no cartão entra na fatura do ciclo e não altera o saldo agora — o dinheiro sai
            quando a fatura for paga.
          </p>
        )}
      </div>

      {/* Parcelar so' na criacao. Mudar o NUMERO de parcelas depois nao e'
          uma edicao — e' apagar a compra e refazer, porque cada parcela ja'
          ocupa uma fatura diferente. Quem precisa disso exclui a compra
          inteira (o botao oferece esse alcance) e lanca de novo. */}
      {noCartao && !editando && (
        <div className="animate-[fade-in_0.25s_ease-out]">
          <Label htmlFor="parcelas">Em quantas vezes</Label>
          <Select
            id="parcelas"
            name="parcelas"
            disabled={pendente}
            value={parcelas}
            onChange={(e) => setParcelas(e.target.value)}
          >
            <option value="1">À vista</option>
            {Array.from({ length: 35 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n}x
              </option>
            ))}
          </Select>

          {divisao ? (
            <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
              <span className="tabular font-medium text-text">
                {divisao.quantidade}x de {formatMoney(divisao.parcela)}
              </span>
              {divisao.sobra > 0 && (
                <>
                  {" "}
                  (a primeira sai{" "}
                  <span className="tabular text-text">
                    {formatMoney(divisao.parcela + divisao.sobra)}
                  </span>
                  , com a sobra dos centavos)
                </>
              )}
              {" — "}uma parcela por fatura, de {divisao.primeiroMes} a {divisao.ultimoMes}.
            </p>
          ) : (
            <p className="mt-1.5 text-[12.5px] text-muted">
              Cada parcela entra na fatura do mês dela, não todas de uma vez.
            </p>
          )}
        </div>
      )}

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

      <div>
        <Label htmlFor="observacao">Observação (opcional)</Label>
        <Input
          id="observacao"
          name="observacao"
          defaultValue={lancamento?.observacao ?? ""}
          placeholder="Algum detalhe que você queira lembrar"
          disabled={pendente}
        />
      </div>

      <FieldError>{estado.erro}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={pendente}>
        {pendente ? (
          <>
            <Carregando size={17} rotulo={null} />
            Salvando...
          </>
        ) : editando ? (
          "Salvar alterações"
        ) : (
          "Salvar lançamento"
        )}
      </Button>
    </form>
  );
}
