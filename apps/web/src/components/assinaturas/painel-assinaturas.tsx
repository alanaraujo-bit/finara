"use client";

import {
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useState, type CSSProperties, type ReactNode } from "react";
import {
  alternarAssinatura,
  cancelarAssinatura,
  criarAssinatura,
  editarAssinatura,
  excluirAssinatura,
  type EstadoAssinatura,
} from "@/app/(app)/assinaturas/actions";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError, Input, Label } from "@/components/ui/input";
import { LinhaDeslizante } from "@/components/ui/linha-deslizante";
import { Modal } from "@/components/ui/modal";
import { formatMoneyBare } from "@/lib/money";
import { SegmentedField, Select } from "@/components/ui/select";
import { ROTULO_CICLO } from "@/lib/recorrencia";
import { cn } from "@/lib/utils";

/** O que a caixa de edicao precisa para abrir preenchida. */
export type AssinaturaEditavel = {
  id: string;
  nome: string;
  valor: number;
  ciclo: string;
  inicio: string;
  categoriaId: string | null;
  titularidade: "conjunto" | "meu";
};

export function FormAssinatura({
  categorias,
  dataPadrao,
  temParceiro,
  assinatura,
  aberto: abertoExterno,
  aoFechar,
}: {
  categorias: { id: string; nome: string }[];
  dataPadrao: string;
  temParceiro: boolean;
  /** Presente = modo edicao. */
  assinatura?: AssinaturaEditavel;
  aberto?: boolean;
  aoFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [instancia, setInstancia] = useState(0);

  if (assinatura) {
    return (
      <Modal
        aberto={Boolean(abertoExterno)}
        aoFechar={aoFechar!}
        titulo="Editar assinatura"
        descricao="A próxima cobrança é recalculada a partir do início e do ciclo."
      >
        <CamposAssinatura
          key={assinatura.id}
          categorias={categorias}
          dataPadrao={dataPadrao}
          temParceiro={temParceiro}
          assinatura={assinatura}
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
        Nova assinatura
      </Button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Nova assinatura"
        descricao="Cobrança que se repete sozinha."
      >
        <CamposAssinatura
          key={instancia}
          categorias={categorias}
          dataPadrao={dataPadrao}
          temParceiro={temParceiro}
          aoConcluir={() => setAberto(false)}
        />
      </Modal>
    </>
  );
}

function CamposAssinatura({
  categorias,
  dataPadrao,
  temParceiro,
  assinatura,
  aoConcluir,
}: {
  categorias: { id: string; nome: string }[];
  dataPadrao: string;
  temParceiro: boolean;
  assinatura?: AssinaturaEditavel;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [titularidade, setTitularidade] = useState<string>(
    assinatura?.titularidade ?? "conjunto",
  );

  const [estado, acao, pendente] = useActionState<EstadoAssinatura, FormData>(
    async (anterior, form) => {
      const resultado = await (assinatura ? editarAssinatura : criarAssinatura)(
        anterior,
        form,
      );
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
        {assinatura && <input type="hidden" name="id" value={assinatura.id} />}
        <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
          <div>
            <Label htmlFor="nome">Serviço</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={assinatura?.nome ?? ""}
              placeholder="Netflix, Spotify, academia..."
              autoComplete="off"
              disabled={pendente}
              required
            />
          </div>
          <div>
            <Label htmlFor="valor">Valor</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-muted">
                R$
              </span>
              <Input
                id="valor"
                name="valor"
                defaultValue={assinatura ? formatMoneyBare(assinatura.valor) : ""}
                inputMode="decimal"
                placeholder="0,00"
                className="tabular pl-11"
                disabled={pendente}
                required
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ciclo">Cobrança</Label>
            <Select
              id="ciclo"
              name="ciclo"
              defaultValue={assinatura?.ciclo ?? "monthly"}
              disabled={pendente}
            >
              {Object.entries(ROTULO_CICLO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="inicio">Primeira cobrança</Label>
            <Input
              id="inicio"
              name="inicio"
              type="date"
              defaultValue={assinatura?.inicio ?? dataPadrao}
              disabled={pendente}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="categoriaId">Categoria</Label>
          <Select
            id="categoriaId"
            name="categoriaId"
            defaultValue={assinatura?.categoriaId ?? ""}
            disabled={pendente}
          >
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
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

      <Button type="submit" size="lg" disabled={pendente} className="w-full">
        {pendente ? (
          <>
            <Carregando size={17} rotulo={null} />
            Criando...
          </>
        ) : (
          "Criar assinatura"
        )}
      </Button>
    </form>
  );
}

/**
 * A LINHA de uma assinatura — o cartão inteiro, e não só os botões do canto.
 *
 * Era `AcoesAssinatura`: quatro ícones enfileirados dentro do cartão, 32px
 * cada, disputando espaço com o nome do serviço e com o valor. No celular a
 * fileira empurrava o valor para fora e o alvo de excluir ficava colado no de
 * pausar.
 *
 * Agora a linha inteira é a superfície. Arrastar para a direita pausa ou
 * retoma — a ação frequente, reversível, que merece o gesto mais fácil.
 * Arrastar para a esquerda revela as de manutenção. No desktop nada mudou de
 * lugar: os mesmos ícones aparecem no hover.
 *
 * As três da esquerda cabem em 228px e param aí de propósito: quatro
 * espremeriam o conteúdo contra a borda e a gaveta deixaria de ser legível de
 * relance.
 */
export function LinhaAssinatura({
  id,
  ativa,
  assinatura,
  categorias,
  dataPadrao,
  temParceiro,
  children,
  className,
  style,
}: {
  id: string;
  ativa: boolean;
  assinatura: AssinaturaEditavel;
  categorias: { id: string; nome: string }[];
  dataPadrao: string;
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
      acaoPrincipal={{
        rotulo: ativa ? "Pausar assinatura" : "Retomar assinatura",
        icone: ativa ? <PauseIcon size={15} weight="fill" /> : <PlayIcon size={15} weight="fill" />,
        tom: "primary",
        executar: async () => {
          await alternarAssinatura(id);
        },
      }}
      acoes={[
        {
          rotulo: "Editar assinatura",
          icone: <PencilSimpleIcon size={15} weight="bold" />,
          aoClicar: () => setEditando(true),
        },
        // Cancelar guarda o registro de que já se assinou aquilo; excluir é
        // para quando o cadastro foi engano. Assinatura não gera lançamento
        // por conta própria, então excluir não deixa histórico órfão.
        {
          rotulo: "Cancelar assinatura",
          icone: <XIcon size={15} weight="bold" />,
          confirmar: "Cancelar de vez?",
          executar: async () => {
            await cancelarAssinatura(id);
          },
        },
        {
          rotulo: "Excluir assinatura",
          icone: <TrashIcon size={15} weight="bold" />,
          perigo: true,
          confirmar: "Excluir?",
          executar: () => excluirAssinatura(id),
        },
      ]}
    >
      <FormAssinatura
        categorias={categorias}
        dataPadrao={dataPadrao}
        temParceiro={temParceiro}
        assinatura={assinatura}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      {children}
    </LinhaDeslizante>
  );
}
