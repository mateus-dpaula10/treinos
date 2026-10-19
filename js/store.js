// Estado do app em memória + ações que gravam no banco (api.js) e avisam as telas.
// Fonte da verdade é o banco: cada ação grava primeiro e só então atualiza o estado local.
// (A exceção é o treino em andamento, que mora no aparelho: veja sessao.js.)
import { api } from './api.js';
import { ehStaffPapel, fichasDoAluno, copiarItens } from './domain.js';
import { debounce, addDays, todayISO } from './utils.js';

export const state = {
  usuario: null, // { id, email }
  membro: null, // linha de membros do usuário (null = ainda não cadastrado)
  membros: [],
  exercicios: [],
  treinos: [],
  sessoes: [],
  carregado: false,
};

const ouvintes = new Set();
/** motivo: 'carga' | 'local' | 'remoto' | 'sessao' */
export const onChange = (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
export const avisar = (motivo) => ouvintes.forEach((fn) => fn(motivo));

const porNome = (a, b) => (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt-BR');
const porInicioDesc = (a, b) => b.inicio.localeCompare(a.inicio);
// Histórico carregado: o último ano (o suficiente para "última vez" e evolução de carga).
const desdeHistorico = () => `${addDays(todayISO(), -400)}T00:00:00.000Z`;

const ler = {
  membros: () => api.listar('membros'),
  exercicios: () => api.listar('exercicios'),
  treinos: () => api.listar('treinos'),
  sessoes: () => api.listar('sessoes', { desde: ['inicio', desdeHistorico()] }),
};
const arrumar = {
  membros: (l) => l.sort(porNome),
  exercicios: (l) => l.sort(porNome),
  treinos: (l) => l.sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome)),
  sessoes: (l) => l.sort(porInicioDesc),
};

export async function carregarTudo() {
  const [membros, exercicios, treinos, sessoes] = await Promise.all([ler.membros(), ler.exercicios(), ler.treinos(), ler.sessoes()]);
  const email = String(state.usuario?.email || '').toLowerCase();
  state.membros = arrumar.membros(membros);
  state.membro = membros.find((m) => m.email === email) || null;
  state.exercicios = arrumar.exercicios(exercicios);
  state.treinos = arrumar.treinos(treinos);
  state.sessoes = arrumar.sessoes(sessoes);
  state.carregado = true;
  avisar('carga');
}

// Mudanças feitas por outras pessoas (tempo real): recarrega a tabela afetada, com um respiro
// para juntar várias mudanças seguidas.
const recarregar = {};
for (const t of ['treinos', 'sessoes', 'exercicios']) {
  recarregar[t] = debounce(async () => {
    try {
      const linhas = arrumar[t](await ler[t]());
      if (t === 'sessoes') {
        // Não some com a sessão que acabou de ser feita aqui e ainda está na fila de envio.
        const ids = new Set(linhas.map((s) => s.id));
        state.sessoes = arrumar.sessoes([...linhas, ...state.sessoes.filter((s) => s._pendente && !ids.has(s.id))]);
      } else state[t] = linhas;
      avisar('remoto');
    } catch (err) { console.warn('[treinos] tempo real:', err.message); }
  }, 500);
}

let pararDeOuvir = null;
export async function ouvirMudancas() {
  pararDeOuvir?.();
  pararDeOuvir = await api.ouvir((tabela) => {
    if (tabela === 'tudo') { carregarTudo().catch(() => {}); return; }
    recarregar[tabela]?.();
  });
}
export function pararTempoReal() { pararDeOuvir?.(); pararDeOuvir = null; }

// ---------- Consultas ----------

export const ehAdmin = () => state.membro?.papel === 'admin';
export const ehStaff = () => ehStaffPapel(state.membro?.papel);
export const eu = () => state.membro?.email || '';
export const pessoa = (email) => state.membros.find((m) => m.email === email) || null;
export const nomePessoa = (email) => pessoa(email)?.nome || String(email || '').split('@')[0] || '—';
export const exercicio = (id) => state.exercicios.find((e) => e.id === id) || null;
export const mapaExercicios = () => new Map(state.exercicios.map((e) => [e.id, e]));
export const treino = (id) => state.treinos.find((t) => t.id === id) || null;
export const sessao = (id) => state.sessoes.find((s) => s.id === id) || null;
export const sessoesDe = (email) => state.sessoes.filter((s) => s.aluno === email);
export const fichasDe = (email) => fichasDoAluno(state.treinos, email);
export const todasFichasDe = (email) => state.treinos.filter((t) => t.aluno === email);
export const modelos = () => state.treinos.filter((t) => t.aluno == null);
export const personais = () => state.membros.filter((m) => ehStaffPapel(m.papel));

/** Alunos que este personal acompanha (admin: todos os alunos). */
export function meusAlunos() {
  const alunos = state.membros.filter((m) => m.papel === 'aluno');
  return ehAdmin() ? alunos : alunos.filter((m) => m.personal === eu());
}

// ---------- Exercícios ----------

export async function salvarExercicio(dados) {
  let linha;
  if (dados.id) {
    const { id, ...patch } = dados;
    linha = await api.atualizar('exercicios', 'id', id, patch);
    state.exercicios = state.exercicios.map((e) => (e.id === id ? linha : e));
  } else {
    [linha] = await api.inserir('exercicios', dados);
    state.exercicios = arrumar.exercicios([...state.exercicios, linha]);
  }
  avisar('local');
  return linha;
}

export async function excluirExercicio(id) {
  await api.apagar('exercicios', 'id', id);
  state.exercicios = state.exercicios.filter((e) => e.id !== id);
  avisar('local');
}

/** Fichas que usam o exercício (para avisar antes de apagar). */
export const fichasComExercicio = (id) => state.treinos.filter((t) => (t.itens || []).some((i) => i.exercicio_id === id));

// ---------- Treinos (fichas) ----------

export async function salvarTreino(dados) {
  let linha;
  if (dados.id) {
    const { id, ...patch } = dados;
    linha = await api.atualizar('treinos', 'id', id, patch);
    state.treinos = arrumar.treinos(state.treinos.map((t) => (t.id === id ? linha : t)));
  } else {
    [linha] = await api.inserir('treinos', dados);
    state.treinos = arrumar.treinos([...state.treinos, linha]);
  }
  avisar('local');
  return linha;
}

export async function excluirTreino(id) {
  await api.apagar('treinos', 'id', id);
  state.treinos = state.treinos.filter((t) => t.id !== id);
  state.sessoes = state.sessoes.map((s) => (s.treino_id === id ? { ...s, treino_id: null } : s));
  avisar('local');
}

/** Copia uma ficha para um aluno (ou para os modelos, com aluno null). Vai para o fim da lista dele. */
export function copiarTreino(id, aluno, { nome } = {}) {
  const t = treino(id);
  const ordem = aluno ? Math.max(-1, ...todasFichasDe(aluno).map((x) => x.ordem)) + 1 : 0;
  return salvarTreino({
    aluno: aluno || null, nome: nome || t.nome, observacoes: t.observacoes, ordem, ativo: true,
    validade: aluno ? t.validade : null, itens: copiarItens(t.itens),
  });
}

/** Troca a ordem de duas fichas do aluno (setas ↑ ↓). */
export async function moverTreino(id, delta) {
  const t = treino(id);
  const lista = todasFichasDe(t.aluno).sort((a, b) => a.ordem - b.ordem);
  const i = lista.findIndex((x) => x.id === id);
  const outro = lista[i + delta];
  if (!outro) return;
  // Renumera tudo (0, 1, 2…) para não depender de ordens repetidas antigas.
  lista.splice(i, 1);
  lista.splice(i + delta, 0, t);
  await Promise.all(lista.map((x, k) => (x.ordem === k ? null : api.atualizar('treinos', 'id', x.id, { ordem: k }))));
  state.treinos = arrumar.treinos(state.treinos.map((x) => { const k = lista.findIndex((y) => y.id === x.id); return k > -1 ? { ...x, ordem: k } : x; }));
  avisar('local');
}

// ---------- Pessoas ----------

/** Cria o login (senha inicial, já confirmado) e cadastra a pessoa. { loginExistia } se ela já tinha login. */
export async function adicionarPessoa(dados) {
  const r = await api.contas('adicionar', { ...dados, email: dados.email.trim().toLowerCase() });
  state.membros = arrumar.membros(await ler.membros());
  avisar('local');
  return r;
}

export async function salvarPessoa(email, patch) {
  const linha = await api.atualizar('membros', 'email', email, patch);
  state.membros = arrumar.membros(state.membros.map((m) => (m.email === email ? linha : m)));
  if (state.membro?.email === email) state.membro = linha;
  avisar('local');
  return linha;
}

/** Admin (ou o personal do aluno) define uma senha nova. */
export const definirSenha = (email, senha) => api.contas('senha', { email, senha });

/** Tira o acesso na hora e apaga fichas e histórico da pessoa; se pedido, apaga o login também. */
export async function removerPessoa(email, apagarLogin = false) {
  const r = await api.contas('remover', { email, apagarLogin });
  state.membros = state.membros.filter((m) => m.email !== email).map((m) => (m.personal === email ? { ...m, personal: null } : m));
  state.treinos = state.treinos.filter((t) => t.aluno !== email);
  state.sessoes = state.sessoes.filter((s) => s.aluno !== email);
  avisar('local');
  return r;
}

// ---------- Sessões já feitas ----------

export async function atualizarSessao(id, patch) {
  const linha = await api.atualizar('sessoes', 'id', id, patch);
  state.sessoes = state.sessoes.map((s) => (s.id === id ? linha : s));
  avisar('local');
  return linha;
}

export async function excluirSessao(id) {
  await api.apagar('sessoes', 'id', id);
  state.sessoes = state.sessoes.filter((s) => s.id !== id);
  avisar('local');
}
