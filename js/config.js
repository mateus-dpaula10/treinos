// Conexão com o Supabase. Deixe em branco para usar o MODO LOCAL (dados só neste navegador, com exemplos),
// útil para conhecer o app antes de criar o projeto.
// Só a chave PÚBLICA ("publishable" / anon) pode ficar aqui: sozinha ela não dá acesso a dado nenhum
// (o banco exige login de alguém cadastrado, veja supabase/schema.sql). NUNCA coloque a service_role.

// Mesmo projeto do painel de Criativos (o plano grátis só permite 2 projetos ativos). As tabelas do Treinos
// ficam no schema "treinos", separadas das dos Criativos (schema "public"). Para voltar ao modo local, apague as duas.
export const SUPABASE_URL = 'https://hbdwyfjcbaddjknbnmej.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Tl02ow1Ik5r143kQxkzqCg_YOArforD';

// Schema das tabelas do app no banco (precisa estar em Project Settings → Data API → Exposed schemas).
export const SUPABASE_SCHEMA = 'treinos';

// Cliente oficial empacotado no próprio app (mesma versão da Caderneta e dos Criativos). Caminho relativo a js/.
export const SUPABASE_LIB = 'vendor/supabase-js-2.117.2.umd.js';

// Onde o supabase-js guarda a sessão (localStorage).
export const AUTH_STORAGE_KEY = 'treinos:auth';

export const MODO_LOCAL = !SUPABASE_URL || !SUPABASE_KEY;
