// Treino em andamento: mora NO APARELHO (localStorage), não no banco. Assim sobrevive a recarregar a
// página, a fechar o app e à academia sem sinal. Só vai para o banco ao concluir; se a internet falhar,
// fica numa fila e é reenviado sozinho quando a conexão voltar (o id é o mesmo: não duplica).
//
// Também cuida do descanso entre séries (pelo relógio: continua certo com a tela apagada), do aviso
// de fim do descanso (som e vibração) e de manter a tela ligada durante o treino.
import { api } from './api.js';
import { state, avisar, treino, mapaExercicios, sessoesDe, eu } from './store.js';
import { novaSessao, marcarSerie, sessaoParaLinha, proximaSerie, restante } from './domain.js';

const chaveSessao = () => `treinos:sessao:${eu()}`;
const chaveFila = () => `treinos:pendentes:${eu()}`;
const CHAVE_PREFS = 'treinos:prefs';

const lerJSON = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
const gravarJSON = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* só não persiste */ } };

// ---------- Preferências do aparelho ----------

const PREFS_PADRAO = { som: true, vibrar: true, telaLigada: true, descansoAuto: true };
export const prefs = () => ({ ...PREFS_PADRAO, ...lerJSON(CHAVE_PREFS, {}) });
export function salvarPrefs(patch) {
  gravarJSON(CHAVE_PREFS, { ...prefs(), ...patch });
  if ('telaLigada' in patch) manterTela();
}

// ---------- Sessão ativa ----------

export const ativa = () => (eu() ? lerJSON(chaveSessao(), null) : null);

function gravar(s) {
  gravarJSON(chaveSessao(), s);
  avisar('sessao');
  return s;
}

/** Começa o treino da ficha. Se já houver outro em andamento, quem chama decide antes (confirmação). */
export function iniciar(treinoId) {
  const t = treino(treinoId);
  if (!t) throw new Error('Treino não encontrado.');
  const s = novaSessao({ treino: t, exercicios: mapaExercicios(), historico: sessoesDe(eu()), aluno: eu() });
  destravarSom();
  gravar(s);
  manterTela();
  return s;
}

export function descartar() {
  gravarJSON(chaveSessao(), null);
  soltarTela();
  avisar('sessao');
}

/** Marca/desmarca a série. Ao marcar, começa o descanso (se não for a última série do treino). */
export function marcar(ex, serie, feita) {
  const s = ativa();
  if (!s) return null;
  destravarSom();
  s.registros = marcarSerie(s.registros, ex, serie, feita);
  if (feita && prefs().descansoAuto && proximaSerie(s.registros)) {
    s.descanso = { fim: Date.now() + s.registros[ex].descanso_s * 1000, total: s.registros[ex].descanso_s, ex, avisado: false };
  } else if (!feita && s.descanso?.ex === ex) s.descanso = null;
  return gravar(s);
}

/** Muda carga ou reps de uma série (sem redesenhar a tela: quem digita não perde o cursor). */
export function alterarSerie(ex, serie, campo, valor) {
  const s = ativa();
  if (!s) return;
  s.registros[ex].series[serie][campo] = valor;
  gravarJSON(chaveSessao(), s);
}

export function adicionarSerie(ex) {
  const s = ativa();
  const series = s.registros[ex].series;
  const ult = series.at(-1);
  series.push({ carga: ult?.carga ?? null, reps: ult?.reps ?? null, feita: false, em: null });
  gravar(s);
}

export function removerSerie(ex) {
  const s = ativa();
  const series = s.registros[ex].series;
  if (series.length <= 1) return;
  const k = series.findLastIndex((x) => !x.feita);
  series.splice(k > -1 ? k : series.length - 1, 1);
  gravar(s);
}

// ---------- Descanso ----------

export function iniciarDescanso(segundos, ex = null) {
  const s = ativa();
  if (!s) return;
  destravarSom();
  s.descanso = { fim: Date.now() + segundos * 1000, total: segundos, ex, avisado: false };
  gravar(s);
}

export function ajustarDescanso(delta) {
  const s = ativa();
  if (!s?.descanso) return;
  const falta = restante(s.descanso.fim);
  const novo = Math.max(0, falta + delta);
  s.descanso = { ...s.descanso, fim: Date.now() + novo * 1000, total: Math.max(s.descanso.total + delta, novo, 1), avisado: novo > 0 ? false : s.descanso.avisado };
  gravar(s);
}

export function pularDescanso() {
  const s = ativa();
  if (!s) return;
  s.descanso = null;
  gravar(s);
}

/** Chamado a cada tique pela barra de descanso: devolve { falta, total } ou null; avisa uma vez no fim. */
export function tiqueDescanso() {
  const s = ativa();
  if (!s?.descanso) return null;
  const falta = restante(s.descanso.fim);
  if (falta === 0 && !s.descanso.avisado) {
    s.descanso.avisado = true;
    gravarJSON(chaveSessao(), s);
    alertarFim();
  }
  return { falta, total: s.descanso.total, acabou: falta === 0 };
}

// ---------- Aviso de fim do descanso ----------

let audio = null;
/** O navegador só deixa tocar som depois de um toque da pessoa: liga o áudio no primeiro toque do treino. */
function destravarSom() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}

function bipe(inicio, freq, dur) {
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, inicio);
  g.gain.exponentialRampToValueAtTime(0.35, inicio + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
  o.connect(g).connect(audio.destination);
  o.start(inicio);
  o.stop(inicio + dur + 0.05);
}

export function alertarFim() {
  const p = prefs();
  if (p.vibrar) navigator.vibrate?.([220, 120, 220, 120, 420]);
  if (p.som && audio) {
    try {
      const t = audio.currentTime + 0.02;
      bipe(t, 880, 0.18); bipe(t + 0.28, 880, 0.18); bipe(t + 0.56, 1320, 0.4);
    } catch { /* sem som */ }
  }
}

/** Toca o aviso para a pessoa testar o volume (Ajustes). */
export function testarAviso() { destravarSom(); setTimeout(alertarFim, 50); }

// ---------- Tela ligada durante o treino ----------

let trava = null;
async function manterTela() {
  if (!ativa() || !prefs().telaLigada) { soltarTela(); return; }
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    if (trava && !trava.released) return;
    trava = await navigator.wakeLock.request('screen');
  } catch { trava = null; /* economia de bateria ou navegador sem suporte */ }
}
function soltarTela() { trava?.release?.().catch(() => {}); trava = null; }
// O sistema solta a trava quando a aba some; pede de novo ao voltar.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') manterTela(); });
export const telaLigadaSuportada = () => 'wakeLock' in navigator;
export const religarTela = manterTela;

// ---------- Concluir e fila de envio ----------

export const pendentes = () => (eu() ? lerJSON(chaveFila(), []) : []);

/** Termina o treino: vira uma linha de "sessoes", entra no histórico na hora e vai para a fila de envio. */
export async function concluir({ esforco = null, nota = '' } = {}) {
  const s = ativa();
  if (!s) return null;
  const linha = sessaoParaLinha(s, { esforco, nota });
  gravarJSON(chaveFila(), [...pendentes().filter((p) => p.id !== linha.id), linha]);
  gravarJSON(chaveSessao(), null);
  soltarTela();
  state.sessoes = [{ ...linha, comentario_personal: '', criado_em: linha.fim, _pendente: true }, ...state.sessoes.filter((x) => x.id !== linha.id)];
  avisar('sessao');
  const r = await enviarPendentes();
  return { linha, enviado: r.falhas === 0, erro: r.erro };
}

let enviando = null;
/** Manda o que estiver na fila. { enviadas, falhas, erro }. */
export function enviarPendentes() {
  if (enviando) return enviando;
  enviando = (async () => {
    let enviadas = 0;
    let erro = null;
    for (const linha of pendentes()) {
      try {
        await api.salvarSessao(linha);
        gravarJSON(chaveFila(), pendentes().filter((p) => p.id !== linha.id));
        state.sessoes = state.sessoes.map((x) => (x.id === linha.id ? { ...x, _pendente: false } : x));
        enviadas++;
      } catch (err) {
        erro = err;
        console.warn('[treinos] envio da sessão:', err.message);
      }
    }
    if (enviadas) avisar('sessao');
    return { enviadas, falhas: pendentes().length, erro };
  })().finally(() => { enviando = null; });
  return enviando;
}

addEventListener('online', () => { if (pendentes().length) enviarPendentes(); });
