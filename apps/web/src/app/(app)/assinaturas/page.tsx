import { and, asc, categories, db, eq, ne, subscriptions } from "@finara/db";
import { RepeatIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { AcoesAssinatura, FormAssinatura } from "@/components/assinaturas/painel-assinaturas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { paraDataLocal, rotuloData } from "@/lib/datas";
import { formatMoney } from "@/lib/money";
import { listarCategorias } from "@/lib/queries/contas";
import { custoMensalEquivalente, ROTULO_CICLO, type Ciclo } from "@/lib/recorrencia";
import { listarMembrosSimples } from "@/lib/queries/contas";
import { exigirSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assinaturas",
};

export default async function AssinaturasPage() {
  const { usuario, workspace } = await exigirSessao();

  const [lista, categoriasTodas, membros] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        nome: subscriptions.name,
        valor: subscriptions.amount,
        ciclo: subscriptions.cycle,
        status: subscriptions.status,
        proxima: subscriptions.nextChargeAt,
        ownerId: subscriptions.ownerId,
        categoria: categories.name,
        categoriaCor: categories.color,
        // Nao aparecem na lista: sao o que a caixa de edicao precisa para
        // abrir preenchida, sem uma segunda consulta por linha.
        inicio: subscriptions.startedAt,
        categoriaId: subscriptions.categoryId,
      })
      .from(subscriptions)
      .leftJoin(categories, eq(categories.id, subscriptions.categoryId))
      .where(
        and(
          eq(subscriptions.workspaceId, workspace.workspaceId),
          // Canceladas somem da lista: quem cancelou nao quer mais ver.
          ne(subscriptions.status, "canceled"),
        ),
      )
      .orderBy(asc(subscriptions.nextChargeAt), asc(subscriptions.name)),
    listarCategorias(workspace.workspaceId),
    listarMembrosSimples(workspace.workspaceId),
  ]);

  const ativas = lista.filter((s) => s.status === "active" || s.status === "trial");

  // Ciclos diferentes so' podem ser somados na mesma base mensal.
  const custoMensal = ativas.reduce(
    (acc, s) => acc + custoMensalEquivalente(s.valor, s.ciclo as Ciclo),
    0,
  );

  const hoje = paraDataLocal();

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex animate-[fade-up_0.4s_var(--ease-out-quint)_both] items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Assinaturas</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {ativas.length === 0 ? (
              "Nenhuma assinatura ativa"
            ) : (
              <>
                {ativas.length} {ativas.length === 1 ? "ativa" : "ativas"} ·{" "}
                <span className="tabular font-medium text-text">{formatMoney(custoMensal)}</span>{" "}
                por mês
              </>
            )}
          </p>
        </div>
        <FormAssinatura
          categorias={categoriasTodas
            .filter((c) => c.tipo === "expense")
            .map((c) => ({ id: c.id, nome: c.nome }))}
          dataPadrao={hoje}
          temParceiro={membros.length > 1}
        />
      </header>

      {lista.length === 0 ? (
        <Card
          className="mt-6 animate-[fade-up_0.45s_var(--ease-out-quint)_both]"
          style={{ animationDelay: "60ms" }}
        >
          <EmptyState
            icone={<RepeatIcon size={26} weight="duotone" />}
            titulo="Streaming, academia, SaaS..."
            descricao="Cadastre o que cobra de você todo mês. O Finara soma tudo numa base mensal, mesmo quando os ciclos são diferentes, e avisa antes de cada cobrança."
          />
        </Card>
      ) : (
        <ul className="mt-6 space-y-2">
          {lista.map((s, i) => {
            const ativa = s.status === "active" || s.status === "trial";
            const mensal = custoMensalEquivalente(s.valor, s.ciclo as Ciclo);

            return (
              <li
                key={s.id}
                className="animate-[fade-up_0.4s_var(--ease-out-quint)_both]"
                style={{ animationDelay: `${60 + i * 40}ms` }}
              >
                <Card className={cn("transition-opacity", !ativa && "opacity-60")}>
                  <CardContent className="flex items-center gap-3.5 p-4">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-xl"
                      style={{
                        background: `${s.categoriaCor ?? "#0ea5e9"}1f`,
                        color: s.categoriaCor ?? "#0ea5e9",
                      }}
                    >
                      <RepeatIcon size={19} weight="duotone" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-text">{s.nome}</p>
                        {!ativa && <Badge tone="warning">Pausada</Badge>}
                        {membros.length > 1 && s.ownerId !== null && (
                          <Badge tone="neutral">
                            {s.ownerId === usuario.id ? "Minha" : "Do parceiro"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-subtle">
                        {ROTULO_CICLO[s.ciclo as Ciclo]}
                        {s.categoria ? ` · ${s.categoria}` : ""}
                        {ativa && s.proxima ? ` · próxima ${rotuloData(s.proxima, hoje)}` : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tabular text-[14px] font-semibold text-text">
                        {formatMoney(s.valor)}
                      </p>
                      {/* Só mostra o equivalente quando difere do valor cobrado,
                          senão vira ruído repetido em assinatura mensal. */}
                      {mensal !== s.valor && (
                        <p className="tabular text-[11px] text-subtle">
                          {formatMoney(mensal)}/mês
                        </p>
                      )}
                    </div>

                    <AcoesAssinatura
                      id={s.id}
                      ativa={ativa}
                      categorias={categoriasTodas.map((c) => ({ id: c.id, nome: c.nome }))}
                      dataPadrao={hoje}
                      temParceiro={membros.length > 1}
                      assinatura={{
                        id: s.id,
                        nome: s.nome,
                        valor: s.valor,
                        ciclo: s.ciclo,
                        inicio: s.inicio,
                        categoriaId: s.categoriaId,
                        titularidade: s.ownerId === usuario.id ? "meu" : "conjunto",
                      }}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
