/**
 * GERADOR DE ASSETS DE MARCA DO FINARA
 *
 *   pnpm --filter @finara/web icons
 *
 * Le a geometria de `src/lib/marca.ts` — o mesmo modulo que o componente
 * `Logo` e o loading usam — e produz TODOS os assets derivados. Rodar isto
 * depois de qualquer mudanca no desenho: o icone do celular, o favicon e a
 * logo dentro do app nunca ficam fora de sincronia porque nenhum deles tem
 * copia propria do traco.
 *
 * O import de `.ts` a partir de um `.mjs` funciona porque o Node 24 remove os
 * tipos sozinho — sem bundler e sem dependencia extra.
 *
 * SAIDAS
 *   src/app/       favicon.ico, icon.svg, apple-icon.png  (convencao do Next)
 *   public/icons/  PWA (any + maskable + monochrome) e telas de abertura
 *   public/        og-image.png
 *   finara-brand-assets/  o pacote completo, na raiz do repositorio
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { MARCA_D, MARCA_PESO, transformeDaMarca } from "../src/lib/marca.ts";
import { APARELHOS_IOS, arquivoSplash } from "../src/lib/splash-ios.ts";

const aqui = dirname(fileURLToPath(import.meta.url));
const web = resolve(aqui, "..");
const pacote = resolve(web, "../..", "finara-brand-assets");
const iconesApp = resolve(web, "public/icons");
const pastaApp = resolve(web, "src/app");

/* ═══════════════════════════════════════════════════════════ cor ══════════
   A paleta vive em OKLCH em `globals.css`, mas PNG e ICO so' entendem sRGB.
   Converter aqui — em vez de anotar hexadecimais na mao — e' o que garante
   que o jade do icone na tela inicial e' o mesmo `--primary` da interface.
   ════════════════════════════════════════════════════════════════════════ */

function oklchParaLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Alguns tons de jade do tema caem fora do sRGB por muito pouco. Cortar o
 * canal estourado mudaria o matiz (o verde puxa pro azul); baixar o croma
 * mantendo luminosidade e matiz preserva a cor que se reconhece como a marca.
 */
function hex(L, C, H) {
  let croma = C;
  let rgb = oklchParaLinear(L, croma, H);
  const cabe = (v) => v.every((n) => n >= -0.0001 && n <= 1.0001);
  for (let i = 0; i < 80 && !cabe(rgb); i++) {
    croma *= 0.98;
    rgb = oklchParaLinear(L, croma, H);
  }
  const gama = (v) => {
    const n = Math.min(1, Math.max(0, v));
    return n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055;
  };
  return `#${rgb.map((v) => Math.round(gama(v) * 255).toString(16).padStart(2, "0")).join("")}`;
}

const MATIZ = 178; // o jade da marca

export const COR = {
  // Gradiente do icone: luz no topo-esquerdo, o meio ancorado no --primary
  // exato da interface, a base descendo o suficiente para dar volume sem
  // virar render 3D.
  claro: {
    alto: hex(0.735, 0.113, MATIZ),
    meio: hex(0.62, 0.118, MATIZ),
    baixo: hex(0.482, 0.098, MATIZ),
    traco: "#ffffff",
  },
  escuro: {
    alto: hex(0.6, 0.112, MATIZ),
    meio: hex(0.475, 0.098, MATIZ),
    baixo: hex(0.318, 0.068, MATIZ),
    traco: hex(0.97, 0.02, MATIZ),
  },
  // Superficies das telas de abertura — o --canvas de cada tema.
  fundoClaro: hex(0.984, 0.003, 264),
  fundoEscuro: hex(0.163, 0.013, 265),
  primariaClara: hex(0.62, 0.118, MATIZ),
  primariaEscura: hex(0.735, 0.121, MATIZ),
};

/* ═══════════════════════════════════════════════════════ desenho ══════════ */

/**
 * Superelipse — o squircle de curvatura continua do iOS, nao um retangulo de
 * cantos arredondados. A diferenca aparece onde a curva encontra a reta: no
 * retangulo ha' uma quebra visivel de curvatura, na superelipse nao ha'.
 */
function squircle(n = 5, passos = 96) {
  const pts = [];
  for (let i = 0; i < passos; i++) {
    const t = (i / passos) * 2 * Math.PI;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push(
      `${(50 + 50 * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(2)} ${(
        50 +
        50 * Math.sign(s) * Math.abs(s) ** (2 / n)
      ).toFixed(2)}`,
    );
  }
  return `M${pts.join("L")}Z`;
}

const SQUIRCLE = squircle();

/**
 * O icone. `fundo` decide a silhueta:
 *   "squircle" — recorte proprio, com fio de luz na borda. Para contextos que
 *                NAO aplicam mascara: aba do navegador, atalho de desktop,
 *                aviso de instalar do Chrome.
 *   "cheio"    — sangra ate' a borda, para quem aplica a propria mascara:
 *                iOS e o maskable do Android. Cantos arredondados aqui seriam
 *                recortados de novo e deixariam halo claro no canto.
 *   "nenhum"   — so' o traco, fundo transparente: tinted do iOS 18,
 *                monochrome do Android 13+, bandeja do Windows.
 *
 * `fator` encolhe a marca sem mexer no fundo — e' o que atende a zona segura
 * do maskable. `ganhoPeso` engrossa o traco nos tamanhos micro, onde um traco
 * proporcional simplesmente some.
 */
function svgIcone({ tamanho, variante = "claro", fundo = "squircle", fator = 1, ganhoPeso = 1 }) {
  const c = COR[variante] ?? COR.claro;
  const semFundo = fundo === "nenhum";
  const corTraco = semFundo ? "#ffffff" : c.traco;

  const silhueta =
    fundo === "squircle"
      ? `<path d="${SQUIRCLE}" fill="url(#g)"/>
  <path d="${SQUIRCLE}" fill="url(#luz)"/>
  <path d="${SQUIRCLE}" fill="none" stroke="#ffffff" stroke-opacity="0.13" stroke-width="0.9"/>`
      : fundo === "cheio"
        ? `<rect width="100" height="100" fill="url(#g)"/>
  <rect width="100" height="100" fill="url(#luz)"/>`
        : "";

  // A sombra sob o traco e' o que separa a marca do fundo sem precisar de
  // contorno. Abaixo de 64px ela vira sujeira cinza, entao some.
  const sombra = !semFundo && tamanho >= 64 ? ` filter="url(#sombra)"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.92" y2="1">
      <stop offset="0" stop-color="${c.alto}"/>
      <stop offset="0.47" stop-color="${c.meio}"/>
      <stop offset="1" stop-color="${c.baixo}"/>
    </linearGradient>
    <radialGradient id="luz" cx="0.24" cy="0.18" r="0.82">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="sombra" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="1.1" stdDeviation="1.5" flood-color="#001b18" flood-opacity="0.26"/>
    </filter>
  </defs>
  ${silhueta}
  <g transform="${transformeDaMarca(fator)}"${sombra}>
    <path d="${MARCA_D}" fill="none" stroke="${corTraco}" stroke-width="${(MARCA_PESO * ganhoPeso).toFixed(3)}" stroke-linecap="round"/>
  </g>
</svg>`;
}

/** Tela de abertura do iOS: superficie do tema com a marca no centro. */
function svgSplash({ largura, altura, escuro }) {
  const m = Math.min(largura, altura) * 0.26;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
  <rect width="${largura}" height="${altura}" fill="${escuro ? COR.fundoEscuro : COR.fundoClaro}"/>
  <g transform="translate(${(largura - m) / 2} ${(altura - m) / 2}) scale(${m / 100})">
    <path d="${MARCA_D}" fill="none" stroke="${escuro ? COR.primariaEscura : COR.primariaClara}" stroke-width="${MARCA_PESO}" stroke-linecap="round"/>
  </g>
</svg>`;
}

/* ═══════════════════════════════════════════════════════ escrita ══════════ */

let contagem = 0;

async function escrever(caminho, buffer) {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, buffer);
  contagem++;
}

// A mesma arte aparece em varios destinos (public do app e pacote de marca).
// O cache evita rasterizar duas vezes o mesmo 1024.
const cache = new Map();

function png(tamanho, opcoes = {}) {
  const chave = JSON.stringify([tamanho, opcoes]);
  if (!cache.has(chave)) {
    cache.set(
      chave,
      sharp(Buffer.from(svgIcone({ tamanho, ...opcoes })))
        .resize(tamanho, tamanho)
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
  }
  return cache.get(chave);
}

async function emitir(tamanho, opcoes, ...destinos) {
  const buffer = await png(tamanho, opcoes);
  for (const d of destinos) await escrever(d, buffer);
}

/**
 * Container ICO. O Windows aceita PNG dentro do ICO desde o Vista, entao cada
 * entrada e' um PNG inteiro — nao e' preciso montar bitmap BMP com mascara
 * AND. O Windows escolhe o tamanho conforme o contexto (16 na bandeja, 32 no
 * explorador, 256 em alta densidade).
 */
function montarIco(entradas) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // 1 = icone
  cabecalho.writeUInt16LE(entradas.length, 4);

  const diretorio = Buffer.alloc(16 * entradas.length);
  let deslocamento = 6 + 16 * entradas.length;

  entradas.forEach(({ tamanho, dados }, i) => {
    const p = 16 * i;
    // 0 significa 256 no formato — um byte nao comporta o valor.
    diretorio.writeUInt8(tamanho >= 256 ? 0 : tamanho, p);
    diretorio.writeUInt8(tamanho >= 256 ? 0 : tamanho, p + 1);
    diretorio.writeUInt16LE(1, p + 4); // planos de cor
    diretorio.writeUInt16LE(32, p + 6); // bits por pixel
    diretorio.writeUInt32LE(dados.length, p + 8);
    diretorio.writeUInt32LE(deslocamento, p + 12);
    deslocamento += dados.length;
  });

  return Buffer.concat([cabecalho, diretorio, ...entradas.map((e) => e.dados)]);
}

/* ══════════════════════════════════════════════════════ producao ══════════ */

console.log("Finara — assets de marca\n");
console.log("· PWA, favicon e Apple");

// "any": silhueta propria — aba, atalho de desktop, aviso de instalar.
for (const t of [192, 512]) {
  await emitir(t, {}, resolve(iconesApp, `icon-${t}.png`), resolve(pacote, `icon/pwa/icon-${t}x${t}.png`));
}

// "maskable": o launcher do Android recorta em circulo ou squircle conforme o
// aparelho. A zona segura e' o circulo central de 80% do lado; com a marca a
// 85% a meia-diagonal fica em ~34 de 40 unidades, com folga em qualquer corte.
for (const t of [192, 512]) {
  await emitir(
    t,
    { fundo: "cheio", fator: 0.85 },
    resolve(iconesApp, `maskable-${t}.png`),
    resolve(pacote, `icon/pwa/icon-maskable-${t}x${t}.png`),
  );
}

// "monochrome": o Android 13+ pinta este com a cor do papel de parede.
await emitir(
  512,
  { fundo: "nenhum", fator: 0.85, ganhoPeso: 1.05 },
  resolve(iconesApp, "monochrome-512.png"),
  resolve(pacote, "icon/android/ic_launcher_monochrome.png"),
);

// Apple: PNG opaco sangrando ate' a borda — o iOS aplica o squircle dele.
await emitir(
  180,
  { fundo: "cheio" },
  resolve(pastaApp, "apple-icon.png"),
  resolve(iconesApp, "apple-touch-icon.png"),
  resolve(pacote, "icon/pwa/apple-touch-icon.png"),
);

// favicon.svg — vetorial, e o unico formato de favicon que troca de cor com o
// tema do sistema. O @media e' avaliado pelo navegador dentro da aba.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    .fundo { fill: ${COR.claro.meio}; }
    .traco { stroke: #ffffff; }
    @media (prefers-color-scheme: dark) {
      .fundo { fill: ${COR.escuro.meio}; }
      .traco { stroke: ${COR.escuro.traco}; }
    }
  </style>
  <path class="fundo" d="${SQUIRCLE}"/>
  <path class="traco" d="${MARCA_D}" fill="none" stroke-width="${(MARCA_PESO * 1.06).toFixed(2)}" stroke-linecap="round"/>
</svg>
`;
await escrever(resolve(pastaApp, "icon.svg"), Buffer.from(faviconSvg));
await escrever(resolve(pacote, "icon/favicon/favicon.svg"), Buffer.from(faviconSvg));

// favicon.ico — nos tamanhos micro o traco proporcional some contra o fundo
// da aba, mas engrossar demais fecha o vazio dentro do laco e a marca vira um
// borrao. 1.14 a 16px e' o ponto em que o contorno ainda respira.
const micro = (t) => ({ ganhoPeso: t <= 16 ? 1.14 : t <= 32 ? 1.2 : 1.06, fator: t <= 32 ? 0.93 : 1 });
const ico = montarIco(
  await Promise.all([16, 32, 48].map(async (t) => ({ tamanho: t, dados: await png(t, micro(t)) }))),
);
await escrever(resolve(pastaApp, "favicon.ico"), ico);
await escrever(resolve(pacote, "icon/favicon/favicon.ico"), ico);
await escrever(resolve(pacote, "icon/windows/app-icon.ico"), ico);

// ------------------------------------------------------------------- splash
console.log("· telas de abertura do iOS");

for (const ap of APARELHOS_IOS) {
  for (const escuro of [false, true]) {
    const buffer = await sharp(
      Buffer.from(svgSplash({ largura: ap.l * ap.dpr, altura: ap.a * ap.dpr, escuro })),
    )
      .png({ compressionLevel: 9 })
      .toBuffer();
    await escrever(resolve(iconesApp, "splash", arquivoSplash(ap, escuro)), buffer);
  }
}

/* ────────────────────────────────────── pacote fora do app ─────────────── */

console.log("· pacote finara-brand-assets");

// master — quadrado cheio, sem transparencia: e' o que store e cliente pedem.
await emitir(1024, { fundo: "cheio" }, resolve(pacote, "icon/master/icon-1024.png"));
await emitir(1024, { fundo: "cheio", variante: "escuro" }, resolve(pacote, "icon/master/icon-1024-dark.png"));
// tinted do iOS 18: traco em fundo transparente — o sistema aplica a cor.
await emitir(1024, { fundo: "nenhum" }, resolve(pacote, "icon/master/icon-1024-tinted.png"));
await escrever(
  resolve(pacote, "icon/master/icon-master.svg"),
  Buffer.from(svgIcone({ tamanho: 1024 })),
);

// iOS
for (const t of [1024, 180, 152, 120, 87, 80, 76, 60, 58, 40]) {
  await emitir(t, { fundo: "cheio" }, resolve(pacote, `icon/ios/AppIcon-${t}x${t}.png`));
}

// macOS — silhueta propria, o Finder nao mascara nada.
for (const t of [1024, 512, 256, 128, 64, 32, 16]) {
  await emitir(t, micro(t), resolve(pacote, `icon/macos/icon_${t}x${t}.png`));
}

// Android — camadas do adaptive icon e as densidades do launcher legado.
await emitir(432, { fundo: "nenhum", fator: 0.62 }, resolve(pacote, "icon/android/ic_launcher_foreground.png"));
await escrever(
  resolve(pacote, "icon/android/ic_launcher_background.png"),
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.92" y2="1">
    <stop offset="0" stop-color="${COR.claro.alto}"/>
    <stop offset="0.47" stop-color="${COR.claro.meio}"/>
    <stop offset="1" stop-color="${COR.claro.baixo}"/>
  </linearGradient></defs>
  <rect width="100" height="100" fill="url(#g)"/>
</svg>`,
    ),
  )
    .png({ compressionLevel: 9 })
    .toBuffer(),
);
// A Play Store exige quadrado cheio, sem canto arredondado e sem sombra.
await emitir(512, { fundo: "cheio" }, resolve(pacote, "icon/android/play_store_512.png"));
for (const [d, t] of [["mdpi", 48], ["hdpi", 72], ["xhdpi", 96], ["xxhdpi", 144], ["xxxhdpi", 192]]) {
  await emitir(t, {}, resolve(pacote, `icon/android/mipmap-${d}/ic_launcher.png`));
}

// Windows — um ICO so' com o traco, para a bandeja do sistema, onde o icone
// aparece a 16px e compete com dezenas de outros.
await escrever(
  resolve(pacote, "icon/windows/app-icon-tray.ico"),
  montarIco(
    await Promise.all(
      [16, 20, 24, 32].map(async (t) => ({
        tamanho: t,
        dados: await png(t, { fundo: "nenhum", fator: 0.96, ganhoPeso: 1.32 }),
      })),
    ),
  ),
);

// social — o Instagram recorta em circulo por conta propria, entao aqui vai
// quadrado cheio; um squircle com transparencia mostraria canto branco.
await emitir(1080, { fundo: "cheio" }, resolve(pacote, "social/profile-instagram-1080.png"));
await emitir(512, { fundo: "cheio" }, resolve(pacote, "social/profile-square-512.png"));

// A tipografia daqui NAO e' a Geist da interface: o rasterizador so' enxerga
// fontes instaladas no sistema, e a Geist e' baixada pelo next/font em tempo
// de build. Para uma imagem de preview de link, a grotesca do sistema resolve;
// se um dia isto virar peca de campanha, o caminho e' vetorizar o texto.
const PILHA = "Segoe UI Semibold, Segoe UI, Helvetica Neue, Arial, sans-serif";

const og = await sharp(
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${COR.claro.alto}"/>
      <stop offset="0.5" stop-color="${COR.claro.meio}"/>
      <stop offset="1" stop-color="${COR.escuro.meio}"/>
    </linearGradient>
    <radialGradient id="l" cx="0.18" cy="0.06" r="0.92">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#f)"/>
  <rect width="1200" height="630" fill="url(#l)"/>
  <g transform="translate(152 186) scale(2.42)">
    <path d="${MARCA_D}" fill="none" stroke="#ffffff" stroke-width="${MARCA_PESO}" stroke-linecap="round"/>
  </g>
  <text x="422" y="290" font-family="${PILHA}" font-size="96" font-weight="600" letter-spacing="-3" fill="#ffffff">Finara</text>
  <text x="424" y="356" font-family="${PILHA}" font-size="38" font-weight="400" letter-spacing="-0.4" fill="#ffffff" fill-opacity="0.82">Seu dinheiro, inteiro.</text>
  <text x="424" y="442" font-family="${PILHA}" font-size="25" font-weight="400" letter-spacing="0.6" fill="#ffffff" fill-opacity="0.6">Contas · Cartões · Assinaturas · Dívidas · A receber</text>
</svg>`),
)
  .png({ compressionLevel: 9 })
  .toBuffer();
await escrever(resolve(pacote, "social/og-image-1200x630.png"), og);
await escrever(resolve(web, "public/og-image.png"), og);

console.log(`\npronto — ${contagem} arquivos.`);
console.log(`  app:    public/icons/ e src/app/`);
console.log(`  pacote: ${pacote}`);
