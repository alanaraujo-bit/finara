/**
 * O `<ViewTransition>` do React ainda não está no `@types/react` estável.
 *
 * Ele existe de verdade: com `experimental.viewTransition` ligado, o Next troca
 * o React do bundle pelo canal experimental, que exporta o componente. O que
 * falta é só a declaração de tipo — sem ela o `tsc` recusa o import de algo que
 * o runtime tem.
 *
 * Declarado aqui o subconjunto que o app usa. Quando o tipo entrar no
 * `@types/react`, este arquivo some e nada mais muda.
 */
import "react";

declare module "react" {
  /** Nome de classe da animação, ou um mapa de tipo de transição para classe. */
  type NomeDeTransicao = string | null | Record<string, string | null>;

  interface ViewTransitionProps {
    children?: React.ReactNode;
    /** Identidade compartilhada entre telas: é o que permite o morph. */
    name?: string;
    enter?: NomeDeTransicao;
    exit?: NomeDeTransicao;
    update?: NomeDeTransicao;
    share?: NomeDeTransicao;
    default?: NomeDeTransicao;
  }

  export const ViewTransition: React.FC<ViewTransitionProps>;
}
