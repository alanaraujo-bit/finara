import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @finara/db exporta .ts direto (sem passo de build proprio), entao o Next
  // precisa transpilar o pacote junto com o app. Sem isto, o build da Vercel
  // quebra no primeiro import do schema.
  transpilePackages: ["@finara/db"],

  // O driver `postgres` usa APIs de Node (net/tls) e nao pode ser empacotado
  // pro bundle do servidor — precisa ser exigido em runtime.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
