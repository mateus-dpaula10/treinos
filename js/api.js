// Acesso a dados e conta. Duas implementações com a mesma interface:
//  - Supabase (login, tempo real), quando js/config.js tem URL e chave;
//  - local (localStorage deste navegador, com dados de exemplo), para conhecer o app antes de configurar.
//    No modo local dá para "entrar como" qualquer pessoa do exemplo (personal ou aluno) em Ajustes.
//
// Decisões (as mesmas da Caderneta e dos Criativos):
//  - supabase-js empacotado em js/vendor/ e carregado só quando precisa;
//  - flowType 'implicit' + detectSessionInUrl desligado: o link do e-mail volta com os tokens no hash e o app
//    lê e limpa esse hash ANTES do roteador (capturarRetornoEmail).
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SCHEMA, SUPABASE_LIB, AUTH_STORAGE_KEY, MODO_LOCAL } from './config.js';
import { uid, todayISO, addDays } from './utils.js';
import { BIBLIOTECA } from './biblioteca.js';
import { novoItem, novaSessao, marcarSerie, sessaoParaLinha } from './domain.js';

export { MODO_LOCAL };

// ---------- Mensagens de erro em português ----------

export function mensagemErro(error) {
  const msg = String(error?.message || error || '');
  const code = String(error?.code || '');
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered|already been registered/i.test(msg)) return 'Esse e-mail já tem conta. Use “Entrar” ou “Esqueci a senha”.';
  if (/password should be at least|weak password/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres, misturando letras e números.';
  if (/rate limit|too many|over_email_send_rate_limit/i.test(msg + code)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  if (/row-level security|permission denied|sem permissão/i.test(msg) || code === '42501') return 'Sem permissão para isso.';
  if (code === 'PGRST106' || /invalid schema|schema must be one of/i.test(msg)) return 'O schema "treinos" ainda não foi liberado no Supabase (Project Settings → Data API → Exposed schemas).';
  if (code === '23505' || /duplicate key/i.test(msg)) return 'Já existe um registro igual.';
  if (code === '23503' || /foreign key/i.test(msg)) return 'Esse registro está ligado a outro que não existe (ou não pode ser apagado).';
  if (code === '23514' || /check constraint/i.test(msg)) return 'Algum campo está fora do permitido (tamanho ou formato).';
  return msg || 'Algo deu errado. Tente de novo.';
}

const falhar = (error) => { const e = new Error(mensagemErro(error)); e.original = error; throw e; };

// ---------- Supabase ----------

let clientPromise = null;

function carregarLib() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL(SUPABASE_LIB, import.meta.url).href;
    s.async = true;
    s.onload = () => (globalThis.supabase?.createClient ? resolve(globalThis.supabase) : reject(new Error('supabase-js não carregou')));
    s.onerror = () => { s.remove(); reject(new Error('Não foi possível carregar o módulo de conexão.')); };
    document.head.appendChild(s);
  });
}

function cliente() {
  if (!clientPromise) {
    clientPromise = carregarLib().then((lib) => lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
      db: { schema: SUPABASE_SCHEMA },
      auth: { storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit' },
    })).catch((err) => { clientPromise = null; throw err; });
  }
  return clientPromise;
}

const appUrl = () => `${location.origin}${location.pathname}`;

/** Chama uma Edge Function e traduz o erro que ela devolve ({ erro }) em mensagem para a tela. */
async function chamarFuncao(nome, body, semResposta) {
  const c = await cliente();
  const { data, error } = await c.functions.invoke(nome, { body });
  if (error) {
    let msg = '';
    try { msg = (await error.context?.json?.())?.erro || ''; } catch { /* resposta sem JSON */ }
    if (!msg) msg = /fetch|send a request|relay|not found/i.test(error.message || '') ? semResposta : (error.message || 'Falhou.');
    throw new Error(msg);
  }
  return data;
}

const supa = {
  /** onde: { coluna: valor } (igual); desde: [coluna, valor] (maior ou igual). */
  async listar(tabela, { ordem, onde, desde } = {}) {
    const c = await cliente();
    let q = c.from(tabela).select('*');
    if (onde) for (const [k, v] of Object.entries(onde)) q = q.eq(k, v);
    if (desde) q = q.gte(desde[0], desde[1]);
    if (ordem) q = q.order(ordem, { ascending: true });
    const { data, error } = await q;
    if (error) falhar(error);
    return data;
  },
  async inserir(tabela, linhas) {
    const c = await cliente();
    const { data, error } = await c.from(tabela).insert(linhas).select();
    if (error) falhar(error);
    return data;
  },
  async atualizar(tabela, chave, valor, patch) {
    const c = await cliente();
    const { data, error } = await c.from(tabela).update(patch).eq(chave, valor).select().single();
    if (error) falhar(error);
    return data;
  },
  async apagar(tabela, chave, valor) {
    const c = await cliente();
    const { error } = await c.from(tabela).delete().eq(chave, valor);
    if (error) falhar(error);
  },
  /** Grava a sessão terminada. O id vem do aparelho: reenviar a mesma (fila sem internet) não duplica. */
  async salvarSessao(linha) {
    const c = await cliente();
    const { error } = await c.from('sessoes').upsert(linha, { onConflict: 'id', ignoreDuplicates: true });
    if (error) falhar(error);
  },
  /** Edge Function "contas": adicionar (cria o login), senha, remover. Admin para todos; personal para os alunos dele. */
  contas: (acao, dados) => chamarFuncao('contas', { acao, ...dados }, 'A função "contas" não respondeu. Ela já foi publicada no Supabase?'),
  /** Avisa quando alguém mexe em treinos, sessões ou exercícios. Devolve função para parar. */
  async ouvir(aoMudar) {
    const c = await cliente();
    const canal = c.channel('app-treinos')
      .on('postgres_changes', { event: '*', schema: SUPABASE_SCHEMA, table: 'treinos' }, () => aoMudar('treinos'))
      .on('postgres_changes', { event: '*', schema: SUPABASE_SCHEMA, table: 'sessoes' }, () => aoMudar('sessoes'))
      .on('postgres_changes', { event: '*', schema: SUPABASE_SCHEMA, table: 'exercicios' }, () => aoMudar('exercicios'))
      .subscribe();
    return () => c.removeChannel(canal);
  },

  // Conta
  async usuario() {
    const c = await cliente();
    const { data } = await c.auth.getSession();
    return data.session?.user || null;
  },
  async entrar(email, senha) {
    const c = await cliente();
    const { data, error } = await c.auth.signInWithPassword({ email, password: senha });
    if (error) falhar(error);
    return data.user;
  },
  async cadastrar(email, senha) {
    const c = await cliente();
    const { data, error } = await c.auth.signUp({ email, password: senha, options: { emailRedirectTo: appUrl() } });
    if (error) falhar(error);
    // Com confirmação de e-mail ligada, não vem sessão: a pessoa precisa clicar no link.
    return { user: data.user, precisaConfirmar: !data.session };
  },
  async recuperar(email) {
    const c = await cliente();
    const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
    if (error) falhar(error);
  },
  async novaSenha(senha) {
    const c = await cliente();
    const { error } = await c.auth.updateUser({ password: senha });
    if (error) falhar(error);
  },
  async sair() {
    const c = await cliente();
    await c.auth.signOut({ scope: 'local' });
  },
  async aoMudarSessao(cb) {
    const c = await cliente();
    c.auth.onAuthStateChange((evento, sessao) => cb(evento, sessao?.user || null));
  },
  async aplicarRetorno(cb) {
    const c = await cliente();
    const { error } = await c.auth.setSession({ access_token: cb.access_token, refresh_token: cb.refresh_token });
    if (error) falhar(error);
  },
};

// ---------- Local (localStorage) ----------

const CHAVE_LOCAL = 'treinos:local';
const CHAVE_EU = 'treinos:local:eu';
const EU_PADRAO = 'voce@modo-local';

function lerEu() {
  try { return localStorage.getItem(CHAVE_EU) || EU_PADRAO; } catch { return EU_PADRAO; }
}

function exemplo() {
  const hoje = todayISO();
  const ts = (dias, hora = 18) => `${addDays(hoje, dias)}T${String(hora).padStart(2, '0')}:00:00.000Z`;
  const exercicios = BIBLIOTECA.map((e) => ({
    id: uid(), nome: e.nome, grupo: e.grupo, equipamento: e.equipamento, video_url: e.video, instrucoes: e.instrucoes,
    criado_por: 'biblioteca', criado_em: ts(-60), atualizado_em: ts(-60),
  }));
  const ex = (nome) => exercicios.find((e) => e.nome === nome).id;
  const it = (nome, series, reps, descanso_s, extra = {}) => novoItem(ex(nome), { series, reps, descanso_s, ...extra });

  const membros = [
    { email: EU_PADRAO, nome: 'Você', papel: 'admin', personal: null, objetivo: '', notas: '', telefone: '', criado_em: ts(-60) },
    { email: 'carla@modo-local', nome: 'Carla Personal', papel: 'personal', personal: null, objetivo: '', notas: '', telefone: '', criado_em: ts(-50) },
    { email: 'ana@modo-local', nome: 'Ana Souza', papel: 'aluno', personal: EU_PADRAO, objetivo: 'Hipertrofia', notas: 'Dor no ombro direito em 2025: evitar desenvolvimento atrás da nuca.', telefone: '', criado_em: ts(-40) },
    { email: 'bruno@modo-local', nome: 'Bruno Lima', papel: 'aluno', personal: EU_PADRAO, objetivo: 'Emagrecimento e condicionamento', notas: '', telefone: '', criado_em: ts(-30) },
    { email: 'diego@modo-local', nome: 'Diego Alves', papel: 'aluno', personal: 'carla@modo-local', objetivo: 'Força', notas: '', telefone: '', criado_em: ts(-20) },
    { email: 'rodrigo@modo-local', nome: 'Rodrigo Miranda', papel: 'aluno', personal: EU_PADRAO, objetivo: '', notas: '', telefone: '', criado_em: ts(0) },
  ];

  const treino = (aluno, nome, ordem, itens, observacoes = '') => ({
    id: uid(), aluno, nome, ordem, ativo: true, validade: aluno ? addDays(hoje, 40) : null, observacoes, itens,
    criado_por: EU_PADRAO, criado_em: ts(-40), atualizado_em: ts(-40),
  });
  const anaA = treino('ana@modo-local', 'Treino A · Peito, ombros e tríceps', 0, [
    it('Supino reto com barra', 4, '8-10', 90, { carga: '30 kg' }),
    it('Supino inclinado com halteres', 3, '10-12', 75),
    it('Crucifixo na máquina (peck deck)', 3, '12', 60),
    it('Elevação lateral', 3, '12-15', 45, { obs: 'Sem impulso. Se travar, baixe o peso.' }),
    it('Tríceps na polia com corda', 3, '12', 45),
    it('Prancha', 3, '30 s', 30),
  ], 'Aquecimento: 5 min de esteira + 1 série leve de supino.');
  const anaB = treino('ana@modo-local', 'Treino B · Costas e bíceps', 1, [
    it('Puxada frontal (pulldown)', 4, '10', 75),
    it('Remada baixa no cabo', 3, '10-12', 75),
    it('Remada unilateral com halter (serrote)', 3, '10', 60),
    it('Rosca direta com barra', 3, '10', 60),
    it('Rosca martelo', 3, '12', 45),
  ]);
  const anaC = treino('ana@modo-local', 'Treino C · Pernas', 2, [
    it('Agachamento livre', 4, '8-10', 120, { obs: 'Desça só até onde a lombar continuar neutra.' }),
    it('Leg press 45°', 3, '12', 90),
    it('Cadeira extensora', 3, '12-15', 60),
    it('Mesa flexora', 3, '12', 60),
    it('Elevação pélvica (hip thrust)', 3, '10', 75),
    it('Panturrilha em pé', 4, '15', 45),
  ]);
  const brunoA = treino('bruno@modo-local', 'Corpo todo A', 0, [
    it('Esteira', 1, '10', 30, { obs: 'Minutos. Ritmo de conversa.' }),
    it('Leg press 45°', 3, '15', 60),
    it('Puxada frontal (pulldown)', 3, '12', 60),
    it('Supino inclinado com halteres', 3, '12', 60),
    it('Abdominal supra (crunch)', 3, '15', 30),
  ]);
  const brunoB = treino('bruno@modo-local', 'Corpo todo B', 1, [
    it('Bicicleta ergométrica', 1, '10', 30),
    it('Afundo com halteres', 3, '10', 60),
    it('Remada baixa no cabo', 3, '12', 60),
    it('Desenvolvimento com halteres', 3, '12', 60),
    it('Prancha', 3, '30 s', 30),
  ]);
  const diegoA = treino('diego@modo-local', 'Força · Supino e terra', 0, [
    it('Supino reto com barra', 5, '5', 150, { carga: '70 kg' }),
    it('Levantamento terra', 5, '5', 180, { carga: '100 kg' }),
  ]);
  const modelo = treino(null, 'Modelo · Iniciante corpo todo', 0, [
    it('Leg press 45°', 3, '12', 60),
    it('Puxada frontal (pulldown)', 3, '12', 60),
    it('Supino inclinado com halteres', 3, '12', 60),
    it('Cadeira flexora', 3, '12', 60),
    it('Prancha', 3, '20 s', 30),
  ], 'Base para as primeiras 4 semanas. Copie para o aluno e ajuste.');
  // Rodrigo Miranda: ABCD, tudo 4 séries (descanso no padrão de 60 s; ajustar na ficha).
  const rod = 'rodrigo@modo-local';
  const r4 = (nome, reps = '8', extra = {}) => it(nome, 4, reps, 60, extra);
  const rodrigoA = treino(rod, 'Treino A · Peito e tríceps', 0, [
    r4('Supino reto com barra'), r4('Supino inclinado com halteres'), r4('Crossover no cabo'),
    r4('Crucifixo na máquina (peck deck)'), r4('Tríceps testa'), r4('Tríceps na polia com corda'), r4('Tríceps francês unilateral'),
  ]);
  const rodrigoB = treino(rod, 'Treino B · Costas e bíceps', 1, [
    r4('Puxada frontal (pulldown)', '8', { obs: 'Pegada aberta.' }), r4('Remada curvada com barra'), r4('Remada baixa no cabo'),
    r4('Puxada neutra'), r4('Rosca direta com barra'), r4('Rosca alternada com halteres'), r4('Rosca martelo'),
  ]);
  const rodrigoC = treino(rod, 'Treino C · Ombros', 2, [
    r4('Desenvolvimento com halteres'), r4('Desenvolvimento na máquina'), r4('Elevação lateral'),
    r4('Elevação lateral unilateral na polia'), r4('Crucifixo inverso na máquina'), r4('Face pull'), r4('Encolhimento'),
  ]);
  const rodrigoD = treino(rod, 'Treino D · Pernas', 3, [
    r4('Agachamento livre'), r4('Leg press 45°', '10'), r4('Cadeira extensora', '12'), r4('Stiff com barra'),
    r4('Mesa flexora', '10'), r4('Panturrilha em pé', '12'), r4('Panturrilha sentado', '15'),
  ]);
  const treinos = [anaA, anaB, anaC, brunoA, brunoB, diegoA, rodrigoA, rodrigoB, rodrigoC, rodrigoD, modelo];

  // Histórico: Ana treina há 3 semanas (A/B/C) com carga subindo; Bruno parou há 9 dias.
  const mapa = new Map(exercicios.map((e) => [e.id, e]));
  const sessoes = [];
  const fazer = (aluno, t, dia, { mais = 0, esforco = 3, pular = 0 } = {}) => {
    let s = novaSessao({ treino: t, exercicios: mapa, aluno, agora: ts(dia, 18) });
    s.registros = s.registros.map((r) => ({
      ...r, series: r.series.map((x) => ({ ...x, carga: x.carga != null ? x.carga + mais : (/Prancha|Esteira|Bicicleta|crunch/i.test(r.nome) ? null : 10 + mais) })),
    }));
    const total = s.registros.length - pular;
    let minuto = 0;
    for (let i = 0; i < total; i++) {
      for (let j = 0; j < s.registros[i].series.length; j++) {
        minuto += 2;
        s.registros = marcarSerie(s.registros, i, j, true, new Date(Date.parse(s.inicio) + minuto * 60000).toISOString());
      }
    }
    sessoes.push({ ...sessaoParaLinha(s, { fim: new Date(Date.parse(s.inicio) + (minuto + 4) * 60000).toISOString(), esforco }), comentario_personal: '', criado_em: s.inicio });
  };
  const ciclo = [anaA, anaB, anaC];
  [-20, -18, -16, -13, -11, -9, -6, -4, -2].forEach((dia, k) => fazer('ana@modo-local', ciclo[k % 3], dia, { mais: Math.floor(k / 3) * 2.5, esforco: 3 + (k % 2) }));
  fazer('bruno@modo-local', brunoA, -14, { esforco: 4 });
  fazer('bruno@modo-local', brunoB, -9, { esforco: 4, pular: 1 });
  fazer('diego@modo-local', diegoA, -1, { esforco: 5 });
  sessoes.at(-4).nota = 'Ombro tranquilo hoje.';
  sessoes.at(-4).comentario_personal = 'Boa! Na próxima, sobe 2 kg no supino.';

  return { membros, exercicios, treinos, sessoes };
}

function lerLocal() {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL);
    if (raw) return JSON.parse(raw);
  } catch { /* sem armazenamento ou corrompido: recomeça com o exemplo */ }
  const db = exemplo();
  gravarLocal(db);
  return db;
}
function gravarLocal(db) {
  try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(db)); } catch { /* só não persiste */ }
}

// Mesmas regras de leitura da RLS do banco (schema.sql), para o modo local mostrar o que cada papel veria.
function visivel(db, tabela, eu) {
  const me = db.membros.find((m) => m.email === eu);
  if (!me) return [];
  const admin = me.papel === 'admin';
  const staff = admin || me.papel === 'personal';
  const podeVer = (email) => email === eu || admin || (staff && db.membros.some((m) => m.email === email && m.personal === eu));
  const linhas = db[tabela] || [];
  if (tabela === 'membros') return linhas.filter((m) => m.email === eu || admin || (staff && (m.papel !== 'aluno' || m.personal === eu)) || m.email === me.personal);
  if (tabela === 'treinos') return linhas.filter((t) => (t.aluno == null ? staff : podeVer(t.aluno)));
  if (tabela === 'sessoes') return linhas.filter((s) => podeVer(s.aluno));
  return linhas;
}

const local = {
  async listar(tabela, { ordem, onde, desde } = {}) {
    const db = lerLocal();
    let linhas = structuredClone(visivel(db, tabela, lerEu()));
    if (onde) linhas = linhas.filter((l) => Object.entries(onde).every(([k, v]) => l[k] === v));
    if (desde) linhas = linhas.filter((l) => l[desde[0]] >= desde[1]);
    if (ordem) linhas.sort((a, b) => (a[ordem] > b[ordem] ? 1 : a[ordem] < b[ordem] ? -1 : 0));
    return linhas;
  },
  async inserir(tabela, linhas) {
    const db = lerLocal();
    const agora = new Date().toISOString();
    const lista = db[tabela] || (db[tabela] = []);
    const novos = (Array.isArray(linhas) ? linhas : [linhas]).map((l) => {
      const n = tabela === 'membros' ? { criado_em: agora, ...l } : { id: uid(), criado_em: agora, ...l };
      if (tabela === 'treinos' || tabela === 'exercicios') { n.atualizado_em = agora; n.criado_por = n.criado_por || lerEu(); }
      if (tabela === 'membros' && lista.some((m) => m.email === n.email)) falhar({ code: '23505', message: 'duplicate key' });
      return n;
    });
    lista.push(...novos);
    gravarLocal(db);
    return structuredClone(novos);
  },
  async atualizar(tabela, chave, valor, patch) {
    const db = lerLocal();
    const l = (db[tabela] || []).find((x) => x[chave] === valor);
    if (!l) falhar('Registro não encontrado.');
    Object.assign(l, patch);
    if (tabela === 'treinos' || tabela === 'exercicios') l.atualizado_em = new Date().toISOString();
    gravarLocal(db);
    return structuredClone(l);
  },
  async apagar(tabela, chave, valor) {
    const db = lerLocal();
    db[tabela] = (db[tabela] || []).filter((x) => x[chave] !== valor);
    if (tabela === 'membros') {
      db.treinos = db.treinos.filter((t) => t.aluno !== valor);
      db.sessoes = db.sessoes.filter((s) => s.aluno !== valor);
      db.membros.forEach((m) => { if (m.personal === valor) m.personal = null; });
    }
    if (tabela === 'treinos') db.sessoes.forEach((s) => { if (s.treino_id === valor) s.treino_id = null; });
    gravarLocal(db);
  },
  async salvarSessao(linha) {
    const db = lerLocal();
    if (!db.sessoes.some((s) => s.id === linha.id)) db.sessoes.push({ comentario_personal: '', criado_em: new Date().toISOString(), ...linha });
    gravarLocal(db);
  },
  /** Modo local: não há logins; só mexe na lista de pessoas. */
  async contas(acao, { email, nome, papel, personal, objetivo, notas, telefone }) {
    const db = lerLocal();
    if (acao === 'adicionar') {
      db.membros = db.membros.filter((m) => m.email !== email);
      db.membros.push({ email, nome: nome || '', papel: papel || 'aluno', personal: personal || null, objetivo: objetivo || '', notas: notas || '', telefone: telefone || '', criado_em: new Date().toISOString() });
    } else if (acao === 'remover') {
      gravarLocal(db);
      await local.apagar('membros', 'email', email);
      return { ok: true, loginApagado: false };
    }
    gravarLocal(db);
    return { ok: true, loginExistia: false, loginApagado: false };
  },
  async ouvir(aoMudar) {
    const fn = (e) => { if (e.key === CHAVE_LOCAL) aoMudar('tudo'); };
    window.addEventListener('storage', fn);
    return () => window.removeEventListener('storage', fn);
  },
  async usuario() { return { id: 'local', email: lerEu() }; },
  async entrar() { return { id: 'local', email: lerEu() }; },
  async cadastrar() { return { precisaConfirmar: false }; },
  async recuperar() {},
  async novaSenha() {},
  async sair() {},
  async aoMudarSessao() {},
  async aplicarRetorno() {},
  /** Modo local: troca a pessoa "logada" (para ver o app como personal ou como aluno). */
  entrarComo(email) {
    try { localStorage.setItem(CHAVE_EU, email); } catch { /* nada */ }
  },
  /** Todas as pessoas do exemplo (para o seletor "entrar como"), sem filtro de permissão. */
  todasAsPessoas: () => structuredClone(lerLocal().membros),
  /** Volta os dados de exemplo (só no modo local). */
  restaurarExemplo() {
    try { localStorage.removeItem(CHAVE_EU); } catch { /* nada */ }
    gravarLocal(exemplo());
  },
};

export const api = MODO_LOCAL ? local : supa;

// ---------- Retorno de link de e-mail ----------

let retornoCapturado = null;

/**
 * Lê o retorno de um link de e-mail (confirmação, convite, recuperação de senha) e LIMPA a URL na hora,
 * para os tokens não ficarem no histórico nem confundirem o roteador por hash. Chamar no início do boot.
 */
export function capturarRetornoEmail() {
  const hash = location.hash.replace(/^#/, '');
  const query = new URLSearchParams(location.search);
  const hp = new URLSearchParams(hash.startsWith('/') ? '' : hash);
  const tem = (k) => hp.has(k) || query.has(k);
  if (!tem('access_token') && !tem('error_description') && !tem('error_code')) return null;
  const val = (k) => hp.get(k) ?? query.get(k);
  retornoCapturado = tem('access_token')
    ? { tipo: 'sessao', evento: val('type') || 'signup', access_token: val('access_token'), refresh_token: val('refresh_token') }
    : { tipo: 'erro', codigo: val('error_code') || val('error') || '', descricao: val('error_description') || '' };
  for (const k of ['access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type', 'type', 'error', 'error_code', 'error_description', 'provider_token', 'sb']) query.delete(k);
  const qs = query.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}#/inicio`);
  return retornoCapturado;
}

export const pegarRetornoEmail = () => { const r = retornoCapturado; retornoCapturado = null; return r; };
