"use client";

import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
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
import { Modal } from "@/components/ui/modal";
import { SegmentedField, Select } from "@/components/ui/select";
import { formatMoney, formatMoneyBare } from "@/lib/money";

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
              autoFocus
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

export function BotaoReceber({
  id,
  valor,
  contas,
}: {
  id: string;
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
        Recebi
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        aria-label="Conta que recebeu"
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
            await receber(id, contaId || undefined);
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
 * Acoes de um recebivel PENDENTE: editar e excluir.
 *
 * A caixa de edicao vive aqui, junto do botao que a abre, e nao no topo da
 * pagina: recebivel e' uma lista curta, e manter o par botao-formulario junto
 * evita ter que sincronizar um "id em edicao" atraves da tela inteira.
 */
export function AcoesRecebivel({
  recebivel,
  temParceiro,
}: {
  recebivel: RecebivelEditavel;
  temParceiro: boolean;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <>
      <FormRecebivel
        temParceiro={temParceiro}
        recebivel={recebivel}
        aberto={editando}
        aoFechar={() => setEditando(false)}
      />
      <AcoesLinha
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
      />
    </>
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
