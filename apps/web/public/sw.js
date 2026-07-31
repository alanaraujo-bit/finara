/**
 * Service worker do Finara.
 *
 * Escrito a mao de proposito. As bibliotecas prontas (serwist/workbox) ainda
 * nao suportam o Turbopack, que e' o padrao do Next 16, e — mais importante —
 * o cache padrao delas guarda resposta de navegacao de forma agressiva. Num
 * app de dinheiro isso e' inaceitavel: saldo velho servido do cache e' pior
 * que tela de erro, porque o usuario acredita no numero.
 *
 * A politica aqui e' explicita:
 *   /_next/static/*  -> cache primeiro (arquivo tem hash no nome, e' imutavel)
 *   /icons, fontes   -> cache primeiro
 *   navegacao (HTML) -> rede primeiro, cache so' como rede de seguranca offline
 *   /api/*           -> SO' rede. Nunca entra em cache, em hipotese nenhuma.
 */

const VERSAO = "finara-v1";
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;

const SHELL = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_ESTATICO);
      // addAll falha inteiro se um item falhar; aqui cada um e' independente
      // pra um icone ausente nao impedir a instalacao do worker.
      await Promise.allSettled(SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

function ehEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|svg|webp|avif|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // POST/PUT/DELETE mudam estado — jamais servir do cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // So' cuidamos da nossa origem.
  if (url.origin !== self.location.origin) return;

  // Dados financeiros e autenticacao: rede, sempre. Sem excecao.
  if (url.pathname.startsWith("/api/")) return;

  if (ehEstatico(url)) {
    event.respondWith(cachePrimeiro(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(redePrimeiro(request));
  }
});

/** Imutavel: se ja' temos, serve na hora e nem toca a rede. */
async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE_ESTATICO);
  const salvo = await cache.match(request);
  if (salvo) return salvo;

  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch {
    return Response.error();
  }
}

/**
 * Rede primeiro. O cache existe apenas pro caso de estar sem internet —
 * enquanto houver rede, o usuario ve' sempre o numero verdadeiro.
 */
async function redePrimeiro(request) {
  const cache = await caches.open(CACHE_PAGINAS);

  try {
    const resposta = await fetch(request);
    if (resposta.ok) cache.put(request, resposta.clone());
    return resposta;
  } catch {
    const salvo = await cache.match(request);
    if (salvo) return salvo;

    const offline = await caches.match("/offline");
    if (offline) return offline;

    return new Response("Sem conexão.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
