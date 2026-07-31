"use client";

import { BankIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registrarConexao } from "@/app/(app)/conexoes/actions";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";

/**
 * Carregado dinamicamente com `ssr: false` porque o `react-pluggy-connect`
 * toca em `window` ja' na avaliacao do modulo.
 *
 * "use client" NAO impede a renderizacao no servidor — apenas marca o
 * componente como interativo no cliente. O Next ainda executa o modulo no
 * servidor para o HTML inicial, e ali `window` nao existe. Sem este dynamic,
 * a pagina inteira quebra com 500.
 */
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((m) => m.PluggyConnect),
  { ssr: false },
);

/**
 * Abre o Pluggy Connect para o usuario autorizar o banco.
 *
 * O token e' buscado SOB DEMANDA, ao clicar — nao num efeito de montagem.
 * Connect Token tem validade curta; buscar no carregamento da pagina faria
 * ele expirar enquanto o usuario le' a tela, e o widget abriria quebrado.
 * Isso tambem evita gastar cota da API em quem so' passou pela pagina.
 */
export function ConectarBanco({ incluirSandbox }: { incluirSandbox: boolean }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const [token, setToken] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setErro(null);
    setCarregando(true);

    try {
      // POST porque a rota cria um recurso e nao pode ser cacheada.
      const resposta = await fetch("/api/connect-token", { method: "POST" });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        setErro(corpo.error ?? "Não consegui iniciar a conexão.");
        return;
      }

      const { accessToken } = await resposta.json();
      setToken(accessToken);
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Button size="lg" onClick={abrir} disabled={carregando}>
        {carregando ? (
          <>
            <SpinnerGapIcon size={17} className="animate-spin" />
            Abrindo...
          </>
        ) : (
          <>
            <BankIcon size={17} weight="duotone" />
            Conectar um banco
          </>
        )}
      </Button>

      <FieldError>{erro}</FieldError>

      {token && (
        <PluggyConnect
          connectToken={token}
          includeSandbox={incluirSandbox}
          language="pt"
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          onSuccess={async (dados) => {
            const resultado = await registrarConexao(dados.item.id);
            setToken(null);

            if (!resultado.ok) {
              setErro(resultado.erro);
              return;
            }
            router.refresh();
          }}
          onError={(erroWidget) => {
            setToken(null);
            setErro(erroWidget.message || "A conexão com o banco falhou.");
          }}
          onClose={() => setToken(null)}
        />
      )}
    </>
  );
}
