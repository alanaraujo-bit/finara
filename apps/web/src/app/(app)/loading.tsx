import { CarregandoTela } from "@/components/ui/carregando";

/**
 * Estado de espera de qualquer tela de (app).
 *
 * Fica DENTRO do shell — a sidebar e a barra inferior continuam desenhadas e
 * clicaveis enquanto a pagina do servidor chega, entao a navegacao nao pisca
 * a interface inteira, so' a area de conteudo.
 *
 * Sem legenda de proposito: a marca se desenhando ja' diz o que precisa, e um
 * "Carregando..." em texto seria a unica coisa a mudar entre uma tela e outra.
 * O rotulo para leitor de tela vive dentro do componente.
 */
export default function Loading() {
  return <CarregandoTela />;
}
