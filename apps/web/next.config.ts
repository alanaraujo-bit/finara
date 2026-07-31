import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @finara/db exporta .ts direto (sem passo de build proprio), entao o Next
  // precisa transpilar o pacote junto com o app. Sem isto, o build da Vercel
  // quebra no primeiro import do schema.
  transpilePackages: ["@finara/db"],

  // O driver `postgres` usa APIs de Node (net/tls) e nao pode ser empacotado
  // pro bundle do servidor — precisa ser exigido em runtime.
  serverExternalPackages: ["postgres"],

  experimental: {
    /**
     * CSS dentro do HTML, em vez de um <link> a' parte.
     *
     * Folha de estilo e' recurso que bloqueia a pintura: o navegador baixa o
     * HTML, encontra o <link>, pede o arquivo e so' entao desenha. Numa rede de
     * celular esse ida-e-volta e' o intervalo em que a tela fica vazia — parte
     * da "tela preta" que aparecia entre tocar no icone e o app surgir.
     *
     * A troca e' nao poder cachear o CSS separado do HTML. Vale a pena aqui
     * porque o Tailwind so' emite as classes usadas: o arquivo e' pequeno, e a
     * navegacao seguinte ja' vem do cache do router, sem HTML novo.
     */
    inlineCss: true,

    /**
     * Cache do router no cliente.
     *
     * O padrao de `dynamic` e' 0 — toda volta pra uma tela ja' visitada refaz a
     * consulta no servidor, e trocar de aba na barra inferior pisca o loading
     * mesmo quando nada mudou. 20 segundos deixam o vai-e-vem instantaneo sem
     * arriscar numero velho: qualquer mutacao chama `router.refresh()`, que
     * invalida este cache inteiro na hora.
     */
    staleTimes: { dynamic: 20, static: 180 },

    /**
     * `@phosphor-icons/react` e' um barril de milhares de icones. Sem isto,
     * cada `import { XIcon }` arrasta o modulo inteiro para o grafo e o
     * compilador reprocessa tudo a cada mudanca.
     */
    optimizePackageImports: ["@phosphor-icons/react"],

    /**
     * Liga a integracao do Next com o `<ViewTransition>` do React: navegar
     * entre telas passa a animar em vez de trocar num corte seco. Ver as
     * regras `::view-transition-*` em `globals.css`.
     */
    viewTransition: true,
  },
};

export default nextConfig;
