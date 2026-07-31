import { PlusIcon, ReceiptIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { ListaLancamentos } from "@/components/lancamentos/lista-lancamentos";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { paraDataLocal } from "@/lib/datas";
import {
  contarLancamentos,
  listarCartoes,
  listarCategorias,
  listarContas,
  listarLancamentos,
  listarMembrosSimples,
} from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Lançamentos",
};

export default async function LancamentosPage() {
  const { usuario, workspace } = await exigirSessao();

  /**
   * Contas, cartoes e categorias vem junto com o extrato porque a caixa de
   * edicao abre sobre a propria lista. Buscar so' no clique daria uma espera
   * visivel bem no meio de uma correcao rapida — e o custo aqui e' de tres
   * consultas curtas, em paralelo com as que ja' aconteciam.
   */
  const [lancamentos, total, contas, cartoes, categorias, membros] = await Promise.all([
    listarLancamentos({ workspaceId: workspace.workspaceId, limite: 100 }),
    contarLancamentos(workspace.workspaceId),
    listarContas(workspace.workspaceId),
    listarCartoes(workspace.workspaceId),
    listarCategorias(workspace.workspaceId),
    listarMembrosSimples(workspace.workspaceId),
  ]);

  const hoje = paraDataLocal();

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Lançamentos</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {total === 0
              ? "Nenhum lançamento ainda"
              : `${total} ${total === 1 ? "lançamento" : "lançamentos"}`}
          </p>
        </div>
        <Link href="/lancamentos/novo" className={cn(buttonVariants({ size: "md" }), "gap-1.5")}>
          <PlusIcon size={16} weight="bold" />
          Novo
        </Link>
      </header>

      <Card
        className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both] overflow-hidden"
        style={{ animationDelay: "60ms" }}
      >
        {lancamentos.length === 0 ? (
          <EmptyState
            icone={<ReceiptIcon size={26} weight="duotone" />}
            titulo="Seu extrato começa aqui"
            descricao="Lance o primeiro gasto ou receita. Leva alguns segundos, e o saldo se atualiza na hora."
            acao={
              <Link
                href="/lancamentos/novo"
                className={cn(buttonVariants({ size: "md" }), "gap-1.5")}
              >
                <PlusIcon size={16} weight="bold" />
                Novo lançamento
              </Link>
            }
          />
        ) : (
          <ListaLancamentos
            lancamentos={lancamentos}
            hoje={hoje}
            usuarioId={usuario.id}
            contas={contas.map((c) => ({ id: c.id, nome: c.name }))}
            cartoes={cartoes.map((c) => ({ id: c.id, nome: c.name }))}
            categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo }))}
            temParceiro={membros.length > 1}
          />
        )}
      </Card>
    </div>
  );
}
