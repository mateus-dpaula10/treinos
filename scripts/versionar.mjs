// Roda na publicação (wrangler.jsonc → build.command): carimba no sw.js a versão (commit) e a lista
// atual de arquivos da interface. Assim cada publicação vira "versão nova" no app instalado, sem ninguém
// precisar lembrar de mudar número. Não precisa rodar à mão.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Só na publicação da Cloudflare (Workers Builds define WORKERS_CI). No PC não mexe em nada: o sw.js fica
// em modo desenvolvimento (tudo da rede) e o `wrangler dev` não entra em looping recarimbando o arquivo.
// Para testar o modo publicado no PC: VERSIONAR=1 node scripts/versionar.mjs (e volte o sw.js depois).
if (!process.env.WORKERS_CI && !process.env.VERSIONAR) {
  console.log('sw.js: fora da Cloudflare, sem carimbo (modo desenvolvimento)');
  process.exit(0);
}

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versao = (process.env.WORKERS_CI_COMMIT_SHA || '').slice(0, 10) || `local-${Date.now().toString(36)}`;

const lista = (dir) => fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = `${dir}/${e.name}`;
  return e.isDirectory() ? lista(rel) : [rel];
});
// A página entra como './' (na Cloudflare 'index.html' redireciona para '/'; ver sw.js).
const arquivos = ['./', 'manifest.webmanifest', ...lista('css'), ...lista('js'), ...lista('icons')];

const swPath = path.join(raiz, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8')
  .replace(/const VERSAO = '[^']*';/, `const VERSAO = '${versao}';`)
  .replace(/const ARQUIVOS = \[[^\]]*\];/, `const ARQUIVOS = ${JSON.stringify(arquivos)};`);
fs.writeFileSync(swPath, sw);
console.log(`sw.js: versão ${versao}, ${arquivos.length} arquivos`);
