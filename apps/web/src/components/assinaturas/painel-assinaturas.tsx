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
import { useActionState, useState, useTransition } from "react";
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
import { AcoesLinha } from "@/components/ui/acoes-linha";
import { Modal } from "@/components/ui/modal";
import { formatMoneyBare } from "@/lib/money";
import { SegmentedField, Select } from "@/components/ui/select";
import { ROTULO_CICLO } from "@/lib/recorrencia";

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
              autoFocus
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

/** Pausar/retomar e cancelar. Cancelar e' irreversivel, entao confirma. */
export function AcoesAssinatura({
  id,
  ativa,
  assinatura,
  categorias,
  dataPadrao,
  temParceiro,
}: {
  id: string;
  ativa: boolean;
  assinatura: AssinaturaEditavel;
  categorias: { id: string; nome: string }[];
  dataPadrao: string;
  temParceiro: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] text-muted">Cancelar de vez?</span>
        <Button
          variant="danger"
          size="sm"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              await cancelarAssinatura(id);
              router.refresh();
            })
          }
        >
          Sim
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
          Não
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <FormAssinatura
        categorias={categorias}
        dataPadrao={dataPadrao}
        temParceiro={temParceiro}
        assinatura={assinatura}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      {/* Editar e excluir de vez. Cancelar (o X ao lado) continua existindo
          para quem quer manter o registro de que ja' assinou; excluir e' para
          quando o cadastro foi engano — assinatura nao gera lancamento por
          conta propria, entao nao ha' historico a preservar. */}
      <AcoesLinha
        className="!opacity-100"
        acoes={[
          {
            rotulo: "Editar assinatura",
            icone: <PencilSimpleIcon size={15} weight="bold" />,
            aoClicar: () => setEditando(true),
          },
          {
            rotulo: "Excluir assinatura",
            icone: <TrashIcon size={15} weight="bold" />,
            perigo: true,
            confirmar: "Excluir?",
            executar: () => excluirAssinatura(id),
          },
        ]}
      />
      <button
        type="button"
        disabled={pendente}
        aria-label={ativa ? "Pausar assinatura" : "Retomar assinatura"}
        onClick={() =>
          iniciar(async () => {
            await alternarAssinatura(id);
            router.refresh();
          })
        }
        className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
      >
        {pendente ? (
          <Carregando size={15} rotulo={null} />
        ) : ativa ? (
          <PauseIcon size={15} weight="fill" />
        ) : (
          <PlayIcon size={15} weight="fill" />
        )}
      </button>
      <button
        type="button"
        aria-label="Cancelar assinatura"
        onClick={() => setConfirmando(true)}
        className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-expense"
      >
        <XIcon size={15} weight="bold" />
      </button>
    </div>
  );
}
