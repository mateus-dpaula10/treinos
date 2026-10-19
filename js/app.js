// Ponto de entrada: conta, carga dos dados, rotas por hash (diferentes para personal e aluno),
// atualização em tempo real e o treino em andamento.
import { state, carregarTudo, ouvirMudancas, pararTempoReal, onChange, ehStaff, exercicio } from './store.js';
import { api, MODO_LOCAL, capturarRetornoEmail, pegarRetornoEmail } from './api.js';
import { aplicarTema, lerTema } from './tema.js';
import { toast, rascunho, abrirVideo } from './ui.js';
import { esc } from './utils.js';
import { icon } from './icons.js';
import { resumoSessao, fmtCronometro } from './domain.js';
import * as inicio from './views/inicio.js';
import * as treino from './views/treino.js';
import * as treinar from './views/treinar.js';
import * as sessaoView from './views/sessao.js';
import * as historico from './views/historico.js';
import * as exercicios from './views/exercicios.js';
import * as alunos from './views/alunos.js';
import * as aluno from './views/aluno.js';
import * as modelos from './views/modelos.js';
import * as ajustes from './views/ajustes.js';
import { abrirFormExercicio } from './views/exercicios.js';
import { telaEntrar, telaPendente, pedirNovaSenha } from './views/entrar.js';
import { iniciarTour, tourVisto } from './tour.js';
import { registrarSW, vigiarConexao } from './pwa.js';
import { iniciarBarraDescanso } from './descanso.js';
import * as sessao from './sessao.js';

// Retorno de link de e-mail (confirmação/convite/recuperação): lê os tokens e limpa a URL ANTES do roteador.
capturarRetornoEmail();

const ocultas = {
  treino: { view: treino, label: 'Ficha', oculto: true, nav: (t) => (ehStaff() ? (t?.aluno ? 'alunos' : 'modelos') : 'inicio') },
  treinar: { view: treinar, label: 'Treinando', oculto: true, nav: () => 'inicio' },
  sessao: { view: sessaoView, label: 'Treino feito', oculto: true, nav: () => (ehStaff() ? 'alunos' : 'historico') },
};
const ROTAS_ALUNO = {
  inicio: { view: inicio, label: 'Hoje', icon: 'home' },
  historico: { view: historico, label: 'Histórico', icon: 'history' },
  exercicios: { view: exercicios, label: 'Exercícios', icon: 'dumbbell' },
  ajustes: { view: ajustes, label: 'Ajustes', icon: 'settings' },
  ...ocultas,
};
const ROTAS_STAFF = {
  inicio: { view: inicio, label: 'Início', icon: 'home', fab: 'aluno' },
  alunos: { view: alunos, label: 'Alunos', icon: 'users', fab: 'aluno' },
  modelos: { view: modelos, label: 'Modelos', icon: 'list' },
  exercicios: { view: exercicios, label: 'Exercícios', icon: 'dumbbell', fab: 'exercicio' },
  ajustes: { view: ajustes, label: 'Ajustes', icon: 'settings' },
  aluno: { view: aluno, label: 'Aluno', oculto: true, nav: () => 'alunos' },
  ...ocultas,
};
const rotas = () => (ehStaff() ? ROTAS_STAFF : ROTAS_ALUNO);

const main = document.getElementById('main');
const shell = document.getElementById('shell');
const fab = document.getElementById('fab');
const faixaTreino = document.getElementById('faixa-treino');
const authRoot = document.getElementById('auth-root');
let ultimaRota = '';
let avisoPendente = null;
let pedirSenhaPendente = false; // voltou de um link de convite/recuperação: a senha vem antes do tour

function lerHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [nome, sub = ''] = path.split('/');
  const rota = rotas()[nome] ? nome : 'inicio';
  return { rota, sub: decodeURIComponent(sub), params: new URLSearchParams(query) };
}

function montarNav() {
  document.getElementById('nav-list').innerHTML = Object.entries(rotas()).filter(([, r]) => !r.oculto).map(([key, r]) => `
    <li><a href="#/${key}" data-route="${key}">${icon(r.icon)}<span>${r.label}</span></a></li>`).join('');
}

/** Faixa "Treino em andamento" em qualquer tela que não seja a do treino. */
let relogioFaixa = null;
function desenharFaixaTreino(rota) {
  const s = state.membro ? sessao.ativa() : null;
  clearInterval(relogioFaixa);
  if (!s || rota === 'treinar') { faixaTreino.hidden = true; return; }
  const r = resumoSessao(s.registros);
  const tempo = () => fmtCronometro((Date.now() - Date.parse(s.inicio)) / 1000);
  faixaTreino.innerHTML = `<a href="#/treinar">${icon('timer', { size: 18 })}<span><strong>Treino em andamento</strong> · ${esc(s.nome_treino)} · ${r.feitas}/${r.total} séries · <span class="cron">${tempo()}</span></span><span class="faixa-voltar">Voltar ao treino</span></a>`;
  faixaTreino.hidden = false;
  const cron = faixaTreino.querySelector('.cron');
  relogioFaixa = setInterval(() => { cron.textContent = tempo(); }, 1000);
}

function render({ manterRolagem = false } = {}) {
  if (!state.carregado || !state.membro) return;
  const { rota, sub, params } = lerHash();
  const def = rotas()[rota];
  const chave = `${rota}/${sub}`;
  const novaRota = chave !== ultimaRota;
  const y = window.scrollY;
  const focoId = main.contains(document.activeElement) ? document.activeElement.id : '';
  if (novaRota) rascunho.clear();
  const ctx = { params, sub, rerender: () => render({ manterRolagem: true }) };
  main.classList.toggle('largo', Boolean(def.largo));
  // Contêiner novo a cada desenho: os ouvintes que a tela registra nele morrem junto (não acumulam).
  const vista = document.createElement('div');
  vista.className = `vista vista-${rota}`;
  vista.innerHTML = def.view.render(ctx);
  main.replaceChildren(vista);
  def.view.mount?.(vista, ctx);
  // Devolve o que estava digitado e não salvo, e o foco do teclado.
  rascunho.forEach((valor, id) => {
    const el = main.querySelector(`#${CSS.escape(id)}`);
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = valor; else el.value = valor;
  });
  if (focoId && !novaRota) main.querySelector(`#${CSS.escape(focoId)}`)?.focus({ preventScroll: true });
  avisoPendente?.remove();
  avisoPendente = null;
  const atual = def.oculto ? def.nav(rota === 'treino' ? state.treinos.find((t) => t.id === sub) : null) : rota;
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === atual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  fab.hidden = !def.fab;
  fab.dataset.acao = def.fab || '';
  fab.setAttribute('aria-label', def.fab === 'exercicio' ? 'Novo exercício' : 'Novo aluno');
  document.body.classList.toggle('treinando', rota === 'treinar');
  desenharFaixaTreino(rota);
  document.title = `${def.label} | Treinos`;
  if (novaRota) {
    ultimaRota = chave;
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement !== document.body && !document.querySelector('dialog[open]')) {
      main.focus({ preventScroll: true });
    }
  } else if (manterRolagem) {
    window.scrollTo(0, y);
  }
}

function eventos() {
  window.addEventListener('hashchange', () => render());
  const guardar = (e) => {
    const el = e.target;
    if (!el.id || el.type === 'file' || el.closest('[data-nao-suja]')) return;
    rascunho.set(el.id, el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value);
  };
  main.addEventListener('input', guardar);
  main.addEventListener('change', guardar);
  fab.innerHTML = icon('plus', { size: 26 });
  fab.addEventListener('click', () => {
    if (fab.dataset.acao === 'exercicio') abrirFormExercicio(null); else alunos.abrirNovoAluno();
  });
  // Botões que aparecem em várias telas (e dentro de diálogos).
  document.addEventListener('click', (e) => {
    const v = e.target.closest('[data-video]');
    if (v) { const ex = exercicio(v.dataset.video); if (ex) abrirVideo(ex); return; }
    if (e.target.closest('[data-novo-aluno]')) alunos.abrirNovoAluno();
  });
  // Ficha com alteração não salva: o navegador pergunta antes de fechar a aba.
  addEventListener('beforeunload', (e) => { if (treino.temAlteracoes()) { e.preventDefault(); e.returnValue = ''; } });

  onChange((motivo) => {
    const { rota } = lerHash();
    if (motivo === 'sessao') {
      // O treino em andamento mudou: só redesenha quem mostra ele.
      if (rota === 'treinar' || rota === 'inicio' || rota === 'historico' || rota === 'sessao') render({ manterRolagem: true });
      else desenharFaixaTreino(rota);
      return;
    }
    const digitando = main.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (motivo === 'remoto' && (digitando || document.querySelector('dialog[open]') || rota === 'treinar' || (rota === 'treino' && treino.temAlteracoes()))) {
      // Não tira o cursor de quem está digitando (nem mexe na tela do treino): avisa e deixa a pessoa escolher a hora.
      if (rota !== 'treinar' && !avisoPendente) {
        avisoPendente = toast('Há novidades.', { timeout: 0, action: { label: 'Atualizar', run: () => render({ manterRolagem: true }) } });
      }
      return;
    }
    render({ manterRolagem: true });
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema(lerTema()));
}

function mostrarEntrar(opcoes) {
  pararTempoReal();
  shell.hidden = true;
  fab.hidden = true;
  faixaTreino.hidden = true;
  Object.assign(state, { usuario: null, membro: null, carregado: false });
  telaEntrar(authRoot, opcoes);
}

async function sair() {
  await api.sair();
  mostrarEntrar();
}

async function entrarNoApp(usuario) {
  state.usuario = usuario;
  authRoot.innerHTML = '<p class="carregando" role="status">Carregando seus treinos…</p>';
  try {
    await carregarTudo();
  } catch (err) {
    console.error('[treinos] carga', err);
    authRoot.innerHTML = `<main class="auth"><div class="auth-card"><h1 class="auth-title">Não foi possível carregar</h1>
      <p>${esc(err.message)}</p><div class="actions left"><button class="btn primary" type="button" data-tentar>Tentar de novo</button>
      <button class="btn ghost" type="button" data-sair>Sair</button></div></div></main>`;
    authRoot.querySelector('[data-tentar]').addEventListener('click', () => entrarNoApp(usuario));
    authRoot.querySelector('[data-sair]').addEventListener('click', sair);
    return;
  }
  if (!state.membro) {
    shell.hidden = true;
    telaPendente(authRoot, { email: usuario.email, onSair: sair, onTentar: () => entrarNoApp(usuario) });
    return;
  }
  authRoot.innerHTML = '';
  montarNav();
  shell.hidden = false;
  ultimaRota = '';
  // Treinos feitos sem internet que ficaram na fila: entram no histórico e tentam ir de novo.
  const fila = sessao.pendentes();
  if (fila.length) {
    const ids = new Set(state.sessoes.map((s) => s.id));
    state.sessoes = [...fila.filter((l) => !ids.has(l.id)).map((l) => ({ comentario_personal: '', criado_em: l.fim, ...l, _pendente: true })), ...state.sessoes]
      .sort((a, b) => b.inicio.localeCompare(a.inicio));
    sessao.enviarPendentes().then((r) => { if (r.enviadas) toast(`${r.enviadas === 1 ? 'Um treino feito sem internet foi enviado' : `${r.enviadas} treinos feitos sem internet foram enviados`}.`); });
  }
  // Atalho do app instalado ("Continuar treino"): abre direto no treino em andamento.
  const params = new URLSearchParams(location.search);
  if (params.get('acao') === 'treinar') {
    history.replaceState(null, '', `${location.pathname}#/${sessao.ativa() ? 'treinar' : 'inicio'}`);
  }
  render();
  ouvirMudancas().catch((err) => console.warn('[treinos] tempo real indisponível:', err.message));
  if (!tourVisto() && !pedirSenhaPendente) setTimeout(iniciarTour, 400);
}

async function boot() {
  aplicarTema(lerTema());
  eventos();
  iniciarBarraDescanso();
  if (MODO_LOCAL) document.getElementById('faixa-local').hidden = false;
  vigiarConexao(toast);
  registrarSW((aplicar) => toast('Nova versão do app disponível.', { timeout: 0, action: { label: 'Atualizar', run: aplicar } }));

  const retorno = pegarRetornoEmail();
  if (retorno?.tipo === 'erro') {
    toast(/expired|invalid/i.test(retorno.descricao) ? 'O link do e-mail expirou ou já foi usado. Peça outro.' : esc(retorno.descricao || 'Link inválido.'), { tone: 'alert', timeout: 9000 });
  } else if (retorno?.tipo === 'sessao') {
    try {
      await api.aplicarRetorno(retorno);
      pedirSenhaPendente = retorno.evento === 'recovery' || retorno.evento === 'invite';
      if (retorno.evento === 'signup') toast('E-mail confirmado.');
    } catch (err) {
      toast(esc(err.message), { tone: 'alert', timeout: 9000 });
    }
  }

  let usuario = null;
  try { usuario = await api.usuario(); } catch (err) { toast(esc(err.message), { tone: 'alert', timeout: 0 }); }
  state.usuario = usuario; // antes de ouvir a sessão: o evento inicial não pode abrir o app em dobro

  await api.aoMudarSessao((evento, user) => {
    if (evento === 'SIGNED_OUT') { if (state.usuario) mostrarEntrar(); return; }
    if (evento === 'PASSWORD_RECOVERY') { pedirNovaSenha(); return; }
    if (evento === 'SIGNED_IN' && user && user.email !== state.usuario?.email) entrarNoApp(user);
  });

  if (!usuario) { mostrarEntrar(); return; }
  await entrarNoApp(usuario);
  if (pedirSenhaPendente) { pedirSenhaPendente = false; pedirNovaSenha({ titulo: 'Defina sua senha' }); }
}

boot();
