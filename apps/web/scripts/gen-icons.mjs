/**
 * Gera os icones do PWA a partir da marca em SVG.
 *
 * Rodar depois de mexer no desenho da logo:
 *   pnpm --filter @finara/web icons
 *
 * Sao dois formatos:
 *  - "any": a marca ocupa a arte toda (usado em aba, atalho de desktop).
 *  - "maskable": o Android recorta o icone em circulo/squircle conforme o
 *    aparelho. A especificacao reserva uma zona segura de 80% no centro, entao
 *    a marca entra menor e o fundo sangra ate' a borda. Sem isso, a logo e'
 *    cortada na tela inicial.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = resolve(raiz, "public/icons");

const JADE = "#1a9e8f";
const CLARO = "#ffffff";

/** A marca do Finara, parametrizada pela escala que ocupa na arte. */
function svg({ size, scale, radius }) {
  const inner = size * scale;
  const offset = (size - inner) / 2;
  const u = inner / 32; // unidade do viewBox original de 32

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${JADE}"/>
  <g transform="translate(${offset} ${offset})">
    <path d="M ${11 * u} ${22.5 * u} V ${10.5 * u} C ${11 * u} ${9.67 * u} ${11.67 * u} ${9 * u} ${12.5 * u} ${9 * u} H ${21 * u}"
          stroke="${CLARO}" stroke-width="${2.75 * u}" stroke-linecap="round" fill="none"/>
    <path d="M ${11.75 * u} ${16 * u} H ${18.5 * u}"
          stroke="${CLARO}" stroke-width="${2.75 * u}" stroke-linecap="round" opacity="0.72"/>
    <circle cx="${21.5 * u}" cy="${21.5 * u}" r="${2.25 * u}" fill="${CLARO}" opacity="0.45"/>
  </g>
</svg>`;
}

async function png(nome, { size, scale, radius }) {
  const buffer = await sharp(Buffer.from(svg({ size, scale, radius })))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(destino, nome), buffer);
  console.log(`  ${nome}  ${(buffer.length / 1024).toFixed(1)} KB`);
}

await mkdir(destino, { recursive: true });
console.log("gerando icones em public/icons:");

// "any": marca cheia, cantos arredondados como no app.
await png("icon-192.png", { size: 192, scale: 1, radius: 44 });
await png("icon-512.png", { size: 512, scale: 1, radius: 116 });

// "maskable": fundo sangrando, marca a 62% no centro (dentro da zona segura).
await png("maskable-192.png", { size: 192, scale: 0.62, radius: 0 });
await png("maskable-512.png", { size: 512, scale: 0.62, radius: 0 });

// Apple nao usa o manifest: precisa de um PNG opaco de 180.
await png("apple-touch-icon.png", { size: 180, scale: 1, radius: 0 });

console.log("pronto.");
