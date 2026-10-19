// Regras puras do app (sem tela, sem banco): testadas em tests/domain.test.js.
import { uid, parseDecimal, todayISO, addDays, parseISODate } from './utils.js';

export const PAPEIS = { admin: 'Admin', personal: 'Personal', aluno: 'Aluno' };
export const ehStaffPapel = (papel) => papel === 'admin' || papel === 'personal';

export const GRUPOS = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebraco: 'Antebraço',
  quadriceps: 'Quadríceps',
  posterior: 'Posterior de coxa',
  gluteos: 'Glúteos',
  panturrilha: 'Panturrilha',
  abdomen: 'Abdômen e core',
  cardio: 'Cardio',
  mobilidade: 'Mobilidade',
  corpo: 'Corpo todo',
};

export const ESFORCO = { 1: 'Muito leve', 2: 'Leve', 3: 'Moderado', 4: 'Pesado', 5: 'No limite' };

export const DESCANSO_PADRAO = 60;
export const DESCANSOS = [30, 45, 60, 75, 90, 120, 150, 180];

// ---------- Vídeo de demonstração ----------

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Segundos de um "t=" do YouTube: "90", "90s", "1m30s", "1h2m3s". */
export function lerInicio(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m || !m[0]) return 0;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

/**
 * Link do YouTube (watch, youtu.be, shorts, embed, live), do Vimeo ou de um arquivo direto (GIF, WebP,
 * imagem, MP4, WebM) → como mostrar dentro do app.
 * { tipo: 'youtube'|'vimeo'|'imagem'|'arquivo', id, embed, src, thumb, vertical } ou null (aí o app só abre o link).
 */
export function embedVideo(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  // Arquivo direto: GIF/WebP/imagem (a animação de "boneco" dos apps de academia) ou MP4/WebM curto.
  const ext = /\.(gif|webp|png|jpe?g|mp4|webm)$/i.exec(u.pathname)?.[1].toLowerCase();
  if (ext) {
    const video = ext === 'mp4' || ext === 'webm';
    return { tipo: video ? 'arquivo' : 'imagem', id: u.href, vertical: false, embed: null, src: u.href, thumb: video ? null : u.href };
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  const partes = u.pathname.split('/').filter(Boolean);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    let id = '';
    let vertical = false;
    if (host === 'youtu.be') id = partes[0] || '';
    else if (partes[0] === 'watch') id = u.searchParams.get('v') || '';
    else if (['shorts', 'embed', 'live', 'v'].includes(partes[0])) { id = partes[1] || ''; vertical = partes[0] === 'shorts'; }
    if (!YT_ID.test(id)) return null;
    const inicio = lerInicio(u.searchParams.get('t') || u.searchParams.get('start'));
    const qs = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (inicio) qs.set('start', String(inicio));
    return {
      tipo: 'youtube', id, vertical,
      embed: `https://www.youtube-nocookie.com/embed/${id}?${qs}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = (host === 'player.vimeo.com' ? partes[1] : partes.find((p) => /^\d+$/.test(p))) || '';
    if (!/^\d{5,12}$/.test(id)) return null;
    // Vídeo não listado: vimeo.com/123456/abcdef → o "h" vai junto, senão não toca.
    const h = u.searchParams.get('h') || (host === 'vimeo.com' && /^[0-9a-f]{6,}$/i.test(partes[partes.indexOf(id) + 1] || '') ? partes[partes.indexOf(id) + 1] : '');
    const qs = new URLSearchParams({ dnt: '1', playsinline: '1' });
    if (h) qs.set('h', h);
    return { tipo: 'vimeo', id, vertical: false, embed: `https://player.vimeo.com/video/${id}?${qs}`, thumb: null };
  }
  return null;
}

/** Nome da fonte do vídeo para "Abrir no …". */
export const fonteVideo = (v) => ({ youtube: 'YouTube', vimeo: 'Vimeo' }[v?.tipo] || 'navegador');

// ---------- Tempo ----------

/** Segundos como "0:42", "12:05" ou "1:02:03". */
export function fmtCronometro(seg) {
  const s = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Duração de um treino: "42 min", "1h05", "menos de 1 min". */
export function fmtDuracao(seg) {
  const min = Math.round((Number(seg) || 0) / 60);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

/** Descanso como texto curto: 90 → "1min30", 60 → "1min", 45 → "45s". */
export function fmtDescanso(seg) {
  const s = Math.round(Number(seg) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}min${String(r).padStart(2, '0')}` : `${m}min`;
}

/**
 * Segundos que faltam de um descanso que acaba em `fimMs` (nunca negativo). Usa o relógio, não contagem:
 * continua certo com a tela apagada ou o app em segundo plano.
 */
export const restante = (fimMs, agoraMs = Date.now()) => Math.max(0, Math.ceil((fimMs - agoraMs) / 1000));

// ---------- Treino (ficha) ----------

/** Item novo de ficha para um exercício. */
export function novoItem(exercicio_id, extra = {}) {
  return { id: uid(), exercicio_id, series: 3, reps: '10-12', carga: '', descanso_s: DESCANSO_PADRAO, obs: '', ...extra };
}

/** Copia os itens de uma ficha com ids novos (duplicar para outro aluno, salvar como modelo). */
export const copiarItens = (itens) => (itens || []).map((i) => ({ ...i, id: uid() }));

/** Primeiro número de um alvo de repetições: "10-12" → 10, "8 a 10" → 8, "30 s" → 30, "falha" → null. */
export function repsAlvo(reps) {
  const m = /\d+/.exec(String(reps ?? ''));
  return m ? Number(m[0]) : null;
}

/** Resumo de uma ficha: "6 exercícios · 20 séries · ~48 min". */
export function resumoTreino(itens) {
  const lista = itens || [];
  const series = lista.reduce((a, i) => a + (Number(i.series) || 0), 0);
  // Estimativa: ~45 s por série + o descanso entre elas.
  const seg = lista.reduce((a, i) => a + (Number(i.series) || 0) * (45 + (Number(i.descanso_s) || 0)), 0);
  return { exercicios: lista.length, series, minutos: Math.round(seg / 60) };
}

/** Fichas ativas do aluno, na ordem montada pelo personal. */
export function fichasDoAluno(treinos, email) {
  return treinos.filter((t) => t.aluno === email && t.ativo).sort((a, b) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome));
}

/**
 * Próxima ficha no rodízio (A → B → C → A…): a que vem depois da última feita.
 * Sem histórico, a primeira. A última feita que não existe mais conta como "nenhuma".
 */
export function proximoTreino(fichas, sessoes) {
  if (!fichas.length) return null;
  const ultima = [...sessoes].filter((s) => s.treino_id).sort((a, b) => b.inicio.localeCompare(a.inicio))
    .find((s) => fichas.some((f) => f.id === s.treino_id));
  if (!ultima) return fichas[0];
  const i = fichas.findIndex((f) => f.id === ultima.treino_id);
  return fichas[(i + 1) % fichas.length];
}

// ---------- Sessão (executando o treino) ----------

/** Última vez que o aluno fez esse exercício com pelo menos uma série feita: { data, series }. */
export function ultimaVez(exercicio_id, sessoes) {
  const ordenadas = [...sessoes].sort((a, b) => b.inicio.localeCompare(a.inicio));
  for (const s of ordenadas) {
    const r = (s.registros || []).find((x) => x.exercicio_id === exercicio_id && x.series?.some((y) => y.feita));
    if (r) return { data: s.inicio, series: r.series.filter((y) => y.feita) };
  }
  return null;
}

/** "3 × 10 · 40 kg" a partir das séries feitas (a carga mais usada; reps da primeira série). */
export function textoSeries(series) {
  if (!series?.length) return '';
  const cargas = series.map((s) => s.carga).filter((c) => c != null && c !== '');
  const max = cargas.length ? Math.max(...cargas.map(Number)) : null;
  const reps = series.map((s) => s.reps).filter((r) => r != null && r !== '');
  const iguais = reps.length && reps.every((r) => r === reps[0]);
  const repsTxt = !reps.length ? '' : iguais ? `${series.length} × ${reps[0]}` : `${series.length} séries (${reps.join('/')})`;
  return [repsTxt || `${series.length} séries`, max != null ? `${fmtKg(max)} kg` : ''].filter(Boolean).join(' · ');
}

export const fmtKg = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));

/**
 * Começa uma sessão a partir da ficha. Cada série já vem com a carga e as reps da última vez
 * (ou com o alvo da ficha), para o aluno só confirmar.
 */
export function novaSessao({ treino, exercicios, historico = [], aluno, agora = new Date().toISOString() }) {
  const registros = (treino.itens || []).map((item) => {
    const ex = exercicios.get(item.exercicio_id);
    const antes = ultimaVez(item.exercicio_id, historico);
    const n = Math.max(1, Math.min(20, Number(item.series) || 1));
    const cargaFicha = parseDecimal(String(item.carga || '').replace(/kg/i, ''));
    const series = Array.from({ length: n }, (_, k) => {
      const ant = antes?.series[Math.min(k, antes.series.length - 1)];
      return {
        carga: ant?.carga ?? (Number.isFinite(cargaFicha) ? cargaFicha : null),
        reps: ant?.reps ?? repsAlvo(item.reps),
        feita: false,
        em: null,
      };
    });
    return {
      item_id: item.id, exercicio_id: item.exercicio_id, nome: ex?.nome || 'Exercício removido', grupo: ex?.grupo || 'corpo',
      reps_alvo: String(item.reps || ''), carga_alvo: String(item.carga || ''), descanso_s: Number(item.descanso_s) || DESCANSO_PADRAO,
      obs: item.obs || '', series,
    };
  });
  return { id: uid(), aluno, treino_id: treino.id, nome_treino: treino.nome, inicio: agora, registros, descanso: null };
}

/** Onde o aluno está: a primeira série não feita ({ ex, serie }) ou null se acabou tudo. */
export function proximaSerie(registros) {
  for (let i = 0; i < registros.length; i++) {
    const j = registros[i].series.findIndex((s) => !s.feita);
    if (j > -1) return { ex: i, serie: j };
  }
  return null;
}

/** Séries feitas, total e volume (kg × reps das séries feitas). */
export function resumoSessao(registros) {
  let feitas = 0;
  let total = 0;
  let volume = 0;
  let exerciciosFeitos = 0;
  for (const r of registros || []) {
    let algum = false;
    for (const s of r.series || []) {
      total++;
      if (!s.feita) continue;
      feitas++;
      algum = true;
      const c = Number(s.carga);
      const rp = Number(s.reps);
      if (Number.isFinite(c) && Number.isFinite(rp) && c > 0 && rp > 0) volume += c * rp;
    }
    if (algum) exerciciosFeitos++;
  }
  return { feitas, total, volume: Math.round(volume * 100) / 100, exerciciosFeitos };
}

/**
 * Marca/desmarca uma série. Ao marcar, a próxima série ainda não feita do mesmo exercício herda
 * carga e reps (quem aumenta o peso numa série costuma manter nas seguintes). Devolve registros novos.
 */
export function marcarSerie(registros, ex, serie, feita, agora = new Date().toISOString()) {
  return registros.map((r, i) => {
    if (i !== ex) return r;
    const series = r.series.map((s, j) => (j === serie ? { ...s, feita, em: feita ? agora : null } : s));
    if (feita) {
      const atual = series[serie];
      const k = series.findIndex((s, j) => j > serie && !s.feita);
      if (k > -1) series[k] = { ...series[k], carga: atual.carga ?? series[k].carga, reps: series[k].reps ?? atual.reps };
    }
    return { ...r, series };
  });
}

/** Linha da tabela "sessoes" a partir da sessão em andamento. */
export function sessaoParaLinha(s, { fim = new Date().toISOString(), esforco = null, nota = '' } = {}) {
  const { feitas, volume } = resumoSessao(s.registros);
  const duracao = Math.max(0, Math.round((Date.parse(fim) - Date.parse(s.inicio)) / 1000));
  return {
    id: s.id, aluno: s.aluno, treino_id: s.treino_id, nome_treino: String(s.nome_treino || '').slice(0, 80),
    inicio: s.inicio, fim, duracao_s: duracao, series_feitas: feitas, volume_kg: volume,
    esforco: esforco ? Number(esforco) : null, nota: String(nota || '').slice(0, 2000),
    registros: s.registros.map(({ item_id, exercicio_id, nome, grupo, reps_alvo, descanso_s, series }) => ({
      item_id, exercicio_id, nome, grupo, reps_alvo, descanso_s,
      series: series.map(({ carga, reps, feita, em }) => ({ carga, reps, feita, em })),
    })),
  };
}

// ---------- Acompanhamento ----------

/** Dias (inteiros) entre a data ISO e hoje. null se não houver data. */
export function diasDesde(iso, hoje = todayISO()) {
  if (!iso) return null;
  // Math.round absorve o dia de 23/25 h do horário de verão.
  return Math.round((parseISODate(hoje) - parseISODate(iso)) / 86400000);
}

/** Data local (YYYY-MM-DD) de um timestamp. */
export const diaLocal = (ts) => todayISO(new Date(ts));

/** Quantos dias diferentes com treino nos últimos `n` dias (hoje incluído). */
export function diasTreinados(sessoes, { n = 7, hoje = todayISO() } = {}) {
  const de = addDays(hoje, -(n - 1));
  return new Set(sessoes.map((s) => diaLocal(s.inicio)).filter((d) => d >= de && d <= hoje)).size;
}

/** Evolução de um exercício: maior carga de cada sessão, da mais antiga para a mais nova. */
export function evolucao(exercicio_id, sessoes) {
  const pontos = [];
  for (const s of sessoes) {
    const r = (s.registros || []).find((x) => x.exercicio_id === exercicio_id);
    const feitas = r?.series?.filter((y) => y.feita && Number(y.carga) > 0) || [];
    if (!feitas.length) continue;
    const melhor = feitas.reduce((a, y) => (Number(y.carga) > Number(a.carga) ? y : a));
    pontos.push({ data: s.inicio, carga: Number(melhor.carga), reps: Number(melhor.reps) || null });
  }
  return pontos.sort((a, b) => a.data.localeCompare(b.data));
}

/** Exercícios com histórico de carga: [{ exercicio_id, nome, primeira, ultima, max, vezes }], mais feitos primeiro. */
export function progressoCargas(sessoes) {
  const nomes = new Map();
  for (const s of sessoes) for (const r of s.registros || []) nomes.set(r.exercicio_id, r.nome);
  return [...nomes.entries()].map(([id, nome]) => {
    const pts = evolucao(id, sessoes);
    if (!pts.length) return null;
    return { exercicio_id: id, nome, primeira: pts[0].carga, ultima: pts.at(-1).carga, max: Math.max(...pts.map((p) => p.carga)), vezes: pts.length, pontos: pts };
  }).filter(Boolean).sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome));
}
