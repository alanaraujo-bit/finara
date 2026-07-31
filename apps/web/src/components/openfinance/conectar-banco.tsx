"use client";

import { BankIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { registrarConexao } from "@/app/(app)/conexoes/actions";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/ui/carregando";
import { FieldError } from "@/components/ui/input";
import { traduzirErroPluggy } from "@/lib/erros-pluggy";

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
            <Carregando size={17} rotulo={null} />
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

      {/*
        Montado no `body`, e nao aqui dentro.

        O `react-pluggy-connect` renderiza uma `<div id="PluggyConnect">` e
        manda o SDK desenhar o modal DENTRO dela — diferente do SDK puro, que
        cai no `body` quando nao recebe container. Preso no meio do card, o
        overlay `position: fixed` fica a merce' de qualquer ancestral que crie
        bloco de contencao (transform, filter, backdrop-filter) e o modal
        aparece espremido num pedaco da tela em vez de centralizado.

        O portal devolve o widget para onde ele espera estar.
      */}
      {token &&
        createPortal(
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
              setErro(traduzirErroPluggy(erroWidget.message));
            }}
            onClose={() => setToken(null)}
          />,
          document.body,
        )}
    </>
  );
}
