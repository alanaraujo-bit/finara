import type { Metadata } from "next";
import { PainelCategorias } from "@/components/categorias/painel-categorias";
import { mesReferencia, nomeDoMes } from "@/lib/datas";
import { listarCategoriasDaTela } from "@/lib/queries/categorias";
import { exigirSessao } from "@/lib/session";

export const metadata: Metadata = {
  title: "Categorias",
};

export default async function CategoriasPage() {
  const { workspace } = await exigirSessao();

  const referencia = mesReferencia();
  const categorias = await listarCategoriasDaTela(workspace.workspaceId, referencia);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      {/* O mes so' vira nome aqui: "julho de 2026" e' texto de tela, nao dado. */}
      <PainelCategorias categorias={categorias} nomeMes={nomeDoMes(referencia).split(" de ")[0]} />
    </div>
  );
}
