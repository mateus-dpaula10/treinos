// Copia a biblioteca inicial de exercícios (js/biblioteca.js) para o supabase/schema.sql, entre as marcas
// "-- BIBLIOTECA" e "-- /BIBLIOTECA". Rode depois de mexer na biblioteca: node scripts/biblioteca-sql.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIBLIOTECA } from '../js/biblioteca.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arq = path.join(raiz, 'supabase', 'schema.sql');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const linhas = BIBLIOTECA.map((e, i) => `    (${q(e.nome)}, ${q(e.grupo)}, ${q(e.equipamento)}, ${q(e.instrucoes)}, ${q(e.video)})${i < BIBLIOTECA.length - 1 ? ',' : ''}`);
const sql = fs.readFileSync(arq, 'utf8');
const novo = sql.replace(/(-- BIBLIOTECA[^\n]*\n)[\s\S]*?(-- \/BIBLIOTECA)/, `$1${linhas.join('\n')}\n$2`);
if (novo === sql && !sql.includes(linhas[0])) throw new Error('Marcas -- BIBLIOTECA não encontradas no schema.sql');
fs.writeFileSync(arq, novo);
console.log(`schema.sql: ${BIBLIOTECA.length} exercícios`);
