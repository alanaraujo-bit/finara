"use client";

import {
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
  criarRecebivel,
  desfazerRecebimento,
  editarRecebivel,
  excluirRecebivel,
  receber,
  type EstadoReceber,
} from "@/app/(app)/a-receber/actions";
import { AcoesLinha } from "@/components/ui/acoes-linha";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { LinhaDeslizante } from "@/components/ui/linha-deslizante";
import { Modal } from "@/components/ui/modal";
import { SegmentedField, Select } from "@/components/ui/select";
import { formatMoney, formatMoneyBare } from "@/lib/money";
import { TATO, vibrar } from "@/lib/tato";
import { cn } from "@/lib/utils";

/** Um recebivel do jeito que o formulario de edicao precisa. */
export type RecebivelEditavel = {
  id: string;
  nome: string;
  devedor: string | null;
  valor: number;
  vencimento: string | null;
  titularidade: "conjunto" | "meu";
};

export function FormRecebivel({
  temParceiro,
  recebivel,
  aberto: abertoExterno,
  aoFechar,
}: {
  temParceiro: boolean;
  /** Presente = modo edicao, controlado por quem lista. */
  recebivel?: RecebivelEditavel;
  aberto?: boolean;
  aoFechar?: () => void;
}) {
  const [abertoInterno, setAberto] = useState(false);
  const [instancia, setInstancia] = useState(0);
  const controlado = recebivel !== undefined;
  const aberto = controlado ? Boolean(abertoExterno) : abertoInterno;
  const fechar = controlado ? aoFechar! : () => setAberto(false);

  // No modo edicao nao ha' botao proprio: quem abre e' a acao da linha.
  if (controlado) {
    return (
      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo="Editar recebível"
        descricao="Corrigir valor, devedor ou previsão."
      >
        <CamposRecebivel
          key={recebivel.id}
          temParceiro={temParceiro}
          recebivel={recebivel}
          aoConcluir={fechar}
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
  recebivel,
  aoConcluir,
}: {
  temParceiro: boolean;
  recebivel?: RecebivelEditavel;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const editando = Boolean(recebivel);
  const [titularidade, setTitularidade] = useState<string>(
    recebivel?.titularidade ?? "conjunto",
  );

  const [estado, acao, pendente] = useActionState<EstadoReceber, FormData>(
    async (anterior, form) => {
      const resultado = await (editando ? editarRecebivel : criarRecebivel)(anterior, form);
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
        {recebivel && <input type="hidden" name="id" value={recebivel.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nome">O que é</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={recebivel?.nome ?? ""}
              placeholder="Freela, empréstimo, reembolso..."
              autoComplete="off"
              disabled={pendente}
              required
            />
          </div>
          <div>
            <Label htmlFor="devedor">Quem me deve</Label>
            <Input
              id="devedor"
              name="devedor"
              defaultValue={recebivel?.devedor ?? ""}
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
                defaultValue={recebivel ? formatMoneyBare(recebivel.valor) : ""}
                placeholder="0,00"
                className="tabular pl-11"
                disabled={pendente}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="vencimento">Previsão (opcional)</Label>
            <Input
              id="vencimento"
              name="vencimento"
              type="date"
              defaultValue={recebivel?.vencimento ?? ""}
              disabled={pendente}
            />
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
            <Carregando size={17} rotulo={null} />
            Salvando...
          </>
        ) : editando ? (
          "Salvar alterações"
        ) : (
          "Criar recebível"
        )}
      </Button>
    </form>
  );
}

/**
 * A folha que registra o recebimento.
 *
 * Era um `<Select>` e dois botões abertos DENTRO da linha, empurrando o nome e
 * o valor para fora dela — e no celular a lista inteira reorganizava só porque
 * alguém tocou em "Recebi". Como folha, a pergunta ("caiu em qual conta?") tem
 * espaço para ser feita por extenso e a linha atrás fica intacta.
 *
 * A escolha da conta importa: é ela que decide qual saldo sobe. "Sem conta"
 * continua sendo resposta válida — dinheiro em espécie existe — e por isso é o
 * padrão em vez de um campo obrigatório que trava quem só quer dar baixa.
 */
function FolhaReceber({
  id,
  valor,
  nome,
  contas,
  aoFechar,
}: {
  id: string;
  valor: number;
  nome: string;
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
      titulo="Registrar recebimento"
      descricao={`${nome} — ${formatMoney(valor)}`}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor={`conta-${id}`}>Caiu em qual conta?</Label>
          <Select
            id={`conta-${id}`}
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
          <p className="mt-1.5 text-[12px] text-subtle">
            Escolhendo uma conta, o valor entra no saldo dela e vira um lançamento no extrato.
          </p>
        </div>

        <Button
          size="lg"
          className="w-full gap-2"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              await receber(id, contaId || undefined);
              vibrar(TATO.concluido);
              aoFechar();
              router.refresh();
            })
          }
        >
          {pendente ? (
            <>
              <Carregando size={17} rotulo={null} />
              Registrando...
            </>
          ) : (
            <>
              <CheckIcon size={16} weight="bold" />
              Recebi {formatMoney(valor)}
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * A LINHA de um recebível pendente.
 *
 * Arrastar para a direita dá baixa — é o que se faz com um recebível, e por
 * isso ganha o gesto positivo. Arrastar para a esquerda revela editar e
 * excluir. No desktop os mesmos três aparecem no hover.
 */
export function LinhaRecebivel({
  recebivel,
  valorEmAberto,
  contas,
  temParceiro,
  children,
  className,
  style,
}: {
  recebivel: RecebivelEditavel;
  valorEmAberto: number;
  contas: { id: string; nome: string }[];
  temParceiro: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [editando, setEditando] = useState(false);
  const [recebendo, setRecebendo] = useState(false);

  return (
    <LinhaDeslizante
      as="li"
      className={cn("rounded-2xl", className)}
      style={style}
      acaoPrincipal={{
        rotulo: "Receber",
        icone: <CheckIcon size={15} weight="bold" />,
        aoClicar: () => setRecebendo(true),
      }}
      acoes={[
        {
          rotulo: "Editar recebível",
          icone: <PencilSimpleIcon size={15} weight="bold" />,
          aoClicar: () => setEditando(true),
        },
        {
          rotulo: "Excluir recebível",
          icone: <TrashIcon size={15} weight="bold" />,
          perigo: true,
          confirmar: "Excluir?",
          executar: () => excluirRecebivel(recebivel.id),
        },
      ]}
    >
      <FormRecebivel
        temParceiro={temParceiro}
        recebivel={recebivel}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      {recebendo && (
        <FolhaReceber
          id={recebivel.id}
          nome={recebivel.nome}
          valor={valorEmAberto}
          contas={contas}
          aoFechar={() => setRecebendo(false)}
        />
      )}
      {children}
    </LinhaDeslizante>
  );
}

/**
 * Desfaz o recebimento: apaga o lancamento gerado e tira o valor de volta da
 * conta. E' o caminho para corrigir um recebimento com valor ou conta errada
 * — sem ele, o unico jeito seria mexer no extrato por fora e deixar as duas
 * telas discordando.
 */
export function BotaoDesfazerRecebimento({ id }: { id: string }) {
  return (
    <AcoesLinha
      acoes={[
        {
          rotulo: "Desfazer recebimento",
          icone: <ArrowCounterClockwiseIcon size={15} weight="bold" />,
          confirmar: "Desfazer?",
          executar: () => desfazerRecebimento(id),
        },
      ]}
    />
  );
}
