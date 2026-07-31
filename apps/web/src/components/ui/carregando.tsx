import { MARCA_D, MARCA_PESO, MARCA_VIEWBOX } from "@/lib/marca";
import { cn } from "@/lib/utils";

/**
 * LOADING DA MARCA
 *
 * Um so' desenho — o traco do Finara — em duas coreografias. Ambas animam
 * `stroke-dashoffset`, propriedade que o navegador resolve no compositor: nao
 * dispara layout nem repaint, entao roda a 60fps ate' em celular fraco e nao
 * engasga enquanto a pagina do servidor esta' chegando.
 *
 * O `pathLength={100}` e' o que torna isso legivel: normaliza o comprimento
 * real do caminho para 100 unidades, entao os keyframes falam em porcentagem
 * do traco em vez de numeros medidos em runtime.
 */

/**
 * Loading em linha — dentro de botao, ao lado de um rotulo.
 *
 * O traco se desenha do inicio ao fim e depois some pelo mesmo lado, num ciclo
 * continuo. Sem "pulo" no fim da volta porque nos dois extremos do ciclo o
 * caminho esta' vazio.
 *
 * O traco fantasma por baixo (opacidade baixa) mantem a silhueta da marca
 * visivel o tempo todo — sem ele, nos tamanhos de botao o desenho pisca e a
 * pessoa nao reconhece o que esta' vendo.
 */
export function Carregando({
  size = 18,
  className,
  rotulo = "Carregando",
}: {
  size?: number;
  className?: string;
  /** Vira o texto acessivel. `null` quando ha' rotulo visivel ao lado. */
  rotulo?: string | null;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARCA_VIEWBOX}
      fill="none"
      role={rotulo ? "status" : undefined}
      aria-label={rotulo ?? undefined}
      aria-hidden={rotulo ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <path
        d={MARCA_D}
        pathLength={100}
        stroke="currentColor"
        strokeWidth={MARCA_PESO}
        strokeLinecap="round"
        opacity={0.22}
      />
      <path
        d={MARCA_D}
        pathLength={100}
        stroke="currentColor"
        strokeWidth={MARCA_PESO}
        strokeLinecap="round"
        className="marca-ciclo"
      />
    </svg>
  );
}

/**
 * Loading de tela — o que aparece enquanto uma rota do servidor esta' sendo
 * montada, e na abertura do app.
 *
 * Aqui a marca se desenha UMA vez e fica: repetir o ciclo numa tela inteira
 * vira nervosismo. Depois de desenhada ela respira devagar, que e' o sinal de
 * "ainda trabalhando" sem competir com o conteudo que vai entrar.
 *
 * O bloco inteiro entra com atraso de 180ms (`marca-entra`): navegacao rapida
 * termina antes disso e a pessoa nunca ve o loading piscar — o que e' pior do
 * que nao ter loading nenhum.
 */
export function CarregandoTela({
  size = 56,
  legenda,
  className,
}: {
  size?: number;
  legenda?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={legenda ?? "Carregando"}
      className={cn(
        "marca-entra flex min-h-[60dvh] flex-col items-center justify-center gap-4",
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox={MARCA_VIEWBOX}
        fill="none"
        aria-hidden="true"
        className="marca-respira text-primary"
      >
        <path
          d={MARCA_D}
          pathLength={100}
          stroke="currentColor"
          strokeWidth={MARCA_PESO}
          strokeLinecap="round"
          className="marca-desenha"
        />
      </svg>
      {legenda ? <p className="text-[13px] text-subtle">{legenda}</p> : null}
    </div>
  );
}
