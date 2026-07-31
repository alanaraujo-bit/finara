/**
 * GEOMETRIA DA MARCA DO FINARA — "Fluxo"
 *
 * Fonte unica de verdade do desenho. Consumida pelo componente `Logo`, pelo
 * loading animado e pelo gerador de assets (`scripts/gen-icons.mjs`, que
 * importa este arquivo direto — o Node 24 remove os tipos sozinho). Mexer no
 * desenho aqui e rodar `pnpm --filter @finara/web icons` regenera todos os
 * icones de todas as plataformas.
 *
 * O TRACO — um laco que se abre e sobe:
 * um arco de 283 graus que nao se fecha e, em vez de morrer, sai pela
 * tangente e dispara pra cima e pra direita. O vao entre a ponta livre do
 * laco e o traco que sobe e' a assinatura do desenho: e' o unico lugar onde
 * as duas partes quase se tocam, e e' o que impede a marca de virar letra.
 *
 * Le como: dinheiro que circula (o laco) e cresce (a subida). O laco quase
 * fechado tambem responde ao "seu dinheiro, inteiro".
 *
 * PARAMETROS DE ORIGEM (canvas 100x100, antes do enquadramento):
 *   centro (44, 56) · raio 24 · ponta livre em 32 graus · saida em 315 graus
 *   peso 12.75 · cauda: comprimento 42, angulo de saida 64 graus
 * O `d` abaixo ja' esta' com translate+scale aplicados para a marca ocupar
 * 63% do canvas, centrada pela caixa delimitadora.
 *
 * POR QUE 63% E SEM ROTACAO: acima de 66% os contornos internos fecham a
 * 60px; qualquer rotacao negativa inclina o laco e o desenho passa a ler
 * como um "d" minusculo.
 */

/** Canvas de desenho da marca. Todo consumidor usa este viewBox. */
export const MARCA_VIEWBOX = "0 0 100 100";

/**
 * O traco. `pathLength="100"` deve ser declarado no <path> que usa isto:
 * normaliza o comprimento para 100 unidades e e' o que permite animar
 * `stroke-dashoffset` com numeros legiveis, sem medir o caminho em runtime.
 */
export const MARCA_D =
  "M59.305 39.770A19.305 19.305 0 1 0 56.584 63.651C67.334 52.901 69.708 44.771 76.372 31.107";

/** Espessura do traco no espaco do viewBox. */
export const MARCA_PESO = 10.256;

/**
 * Reescala a marca em torno do centro do canvas.
 *
 * Serve ao icone `maskable` do Android, onde a zona segura e' um circulo de
 * 40% do lado: a marca precisa encolher enquanto o fundo sangra ate' a borda.
 * Quem usar isto tem que multiplicar `MARCA_PESO` pelo mesmo fator, senao o
 * traco engorda em relacao ao desenho.
 */
export function transformeDaMarca(fator: number): string {
  const deslocamento = (50 * (1 - fator)).toFixed(3);
  return `translate(${deslocamento} ${deslocamento}) scale(${fator})`;
}
