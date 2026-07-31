import { MARCA_D, MARCA_PESO, MARCA_VIEWBOX } from "@/lib/marca";
import { cn } from "@/lib/utils";

/**
 * O traco da marca, sozinho e sem fundo. Herda a cor de quem o contem
 * (`currentColor`), entao serve tanto branco sobre o jade quanto
 * monocromatico dentro de um botao.
 *
 * A espessura escala junto com o desenho de proposito (nada de
 * `vectorEffect="non-scaling-stroke"`): traco de largura fixa engordaria em
 * relacao a marca nos tamanhos pequenos e fecharia os contornos internos.
 */
export function Marca({
  size = 28,
  className,
  peso = MARCA_PESO,
}: {
  size?: number;
  className?: string;
  peso?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARCA_VIEWBOX}
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        d={MARCA_D}
        pathLength={100}
        stroke="currentColor"
        strokeWidth={peso}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A marca dentro do selo jade — o mesmo objeto que fica na tela inicial do
 * celular, para o app e o icone instalado nao lerem como marcas diferentes.
 *
 * O gradiente vive no CSS, e nao num `<linearGradient>` do SVG, por dois
 * motivos: nao produz `id` duplicado quando a logo aparece mais de uma vez na
 * pagina (isto roda em Server Component, onde `useId` nao existe), e
 * acompanha o token `--primary` nos dois temas de graca.
 *
 * O raio de 22.37% e' a proporcao do squircle do iOS — o selo na tela tem a
 * mesma silhueta do icone no springboard.
 */
export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.2237 }}
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden text-[var(--primary-fg)]",
        "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_78%,white)_0%,var(--primary)_48%,color-mix(in_oklab,var(--primary)_84%,black)_100%)]",
        className,
      )}
    >
      <Marca size={size} />
    </span>
  );
}

/**
 * O nome. Tracking levemente negativo porque o Geist em semibold abre demais
 * entre as letras redondas de "Finara" no tamanho de interface.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[17px] font-semibold tracking-[-0.018em] text-text", className)}>
      Finara
    </span>
  );
}
