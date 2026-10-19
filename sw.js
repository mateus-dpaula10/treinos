// Service worker do app: guarda a interface (HTML, CSS, JS, ícones) no aparelho para abrir na hora e
// funcionar como app instalado. Os DADOS não ficam aqui: vêm sempre do Supabase (outro domínio, não passa
// por este arquivo).
//
// VERSAO e ARQUIVOS são preenchidos a cada publicação na Cloudflare (scripts/versionar.mjs, rodado pelo
// wrangler). Versão nova = cache novo = o app oferece "Atualizar". Sem carimbo (desenvolvimento local),
// tudo vem da rede, para nunca servir arquivo velho enquanto se programa.
const VERSAO = '__VERSAO__';
// A página entra como './' e não 'index.html': na Cloudflare 'index.html' redireciona para '/', e o
// navegador recusa abrir uma resposta redirecionada vinda do service worker (quebraria o modo sem internet).
const ARQUIVOS = ['./', 'manifest.webmanifest', 'css/styles.css', 'js/app.js'];

const DEV = VERSAO.startsWith('__');
const CACHE = `treinos-${VERSAO}`;

/** Resposta redirecionada não pode ser entregue a uma navegação: copia o conteúdo numa resposta "limpa". */
async function limpa(resp) {
  if (!resp?.redirected) return resp;
  return new Response(await resp.blob(), { status: resp.status, statusText: resp.statusText, headers: resp.headers });
}

self.addEventListener('install', (event) => {
  if (DEV) { self.skipWaiting(); return; }
  // Baixa tudo da rede (sem cache HTTP) para a versão nova nascer completa.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n.startsWith('treinos-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// A página manda isto quando a pessoa clica em "Atualizar".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase e afins: direto na rede
  if (DEV) return;

  // Navegação (abrir o app, recarregar): a página do cache, para abrir na hora e sem internet.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const c = await caches.open(CACHE);
      return (await limpa(await c.match('./'))) || fetch(req);
    })());
    return;
  }

  // Arquivos da interface: do cache desta versão; o que faltar vem da rede e passa a ficar guardado.
  event.respondWith((async () => {
    const c = await caches.open(CACHE);
    const salvo = await c.match(req, { ignoreSearch: true });
    if (salvo) return salvo;
    const resp = await fetch(req);
    if (resp.ok && resp.type === 'basic') c.put(req, resp.clone());
    return resp;
  })());
});
