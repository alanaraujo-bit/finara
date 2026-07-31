import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { FormLancamento } from "@/components/lancamentos/form-lancamento";
import { Card, CardContent } from "@/components/ui/card";
import { paraDataLocal } from "@/lib/datas";
import { listarCategorias, listarContas, listarMembrosSimples } from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";

export const metadata: Metadata = {
  title: "Novo lançamento",
};

export default async function NovoLancamentoPage() {
  const { workspace } = await exigirSessao();

  const [contas, categorias, membros] = await Promise.all([
    listarContas(workspace.workspaceId),
    listarCategorias(workspace.workspaceId),
    listarMembrosSimples(workspace.workspaceId),
  ]);

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-6 sm:px-6 lg:py-10">
      <Link
        href="/lancamentos"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <ArrowLeftIcon size={15} weight="bold" />
        Lançamentos
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-text">Novo lançamento</h1>

      <Card
        className="mt-5 animate-[fade-up_0.4s_var(--ease-out-quint)_both]"
        style={{ animationDelay: "40ms" }}
      >
        <CardContent className="p-5 sm:p-6">
          <FormLancamento
            contas={contas.map((c) => ({ id: c.id, nome: c.name }))}
            categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo }))}
            dataPadrao={paraDataLocal()}
            temParceiro={membros.length > 1}
          />
        </CardContent>
      </Card>
    </div>
  );
}
