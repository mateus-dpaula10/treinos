// Treinando (#/treinar): a sessão em andamento. Cada exercício com as séries (carga, reps, ✓), o destaque
// de onde o aluno está, o descanso que começa sozinho ao marcar a série e o "Concluir treino".
import { exercicio, sessoesDe, eu } from '../store.js';
import { proximaSerie, resumoSessao, fmtCronometro, fmtDuracao, fmtDescanso, ultimaVez, textoSeries, ESFORCO, fmtKg } from '../domain.js';
import { esc, parseDecimal, plural } from '../utils.js';
import { emptyState, grupoTag, botaoVideo, animacaoMini, openDialog, sheetHeader, enquanto, toast, confirmDialog } from '../ui.js';
import { icon } from '../icons.js';
import * as sessao from '../sessao.js';

let relogio = null;

const valorCampo = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));

function linhaSerie(s, i, j, atual) {
  const agora = atual?.ex === i && atual?.serie === j;
  const id = (c) => `sr-${i}-${j}-${c}`;
  return `<li class="serie ${s.feita ? 'feita' : ''} ${agora ? 'agora' : ''}" data-ex="${i}" data-serie="${j}">
    <span class="serie-n">${agora ? '<span class="sr-only">Agora: </span>' : ''}${j + 1}</span>
    <label class="serie-campo" for="${id('c')}"><span class="sr-only">Carga da série ${j + 1} (kg)</span>
      <input id="${id('c')}" data-campo="carga" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${esc(valorCampo(s.carga))}" placeholder="—" data-nao-suja><span class="unid" aria-hidden="true">kg</span></label>
    <label class="serie-campo" for="${id('r')}"><span class="sr-only">Repetições da série ${j + 1}</span>
      <input id="${id('r')}" data-campo="reps" inputmode="numeric" enterkeyhint="done" autocomplete="off" value="${esc(valorCampo(s.reps))}" placeholder="—" data-nao-suja><span class="unid" aria-hidden="true">reps</span></label>
    <button type="button" class="check-serie" data-marcar aria-pressed="${s.feita}" aria-label="${s.feita ? 'Desmarcar' : 'Marcar'} série ${j + 1} como feita">${icon('check', { size: 26 })}</button>
  </li>`;
}

function cartaoExercicio(r, i, atual, hist) {
  const ex = exercicio(r.exercicio_id) || { id: r.exercicio_id, nome: r.nome, grupo: r.grupo, video_url: '', instrucoes: '' };
  const feitas = r.series.filter((s) => s.feita).length;
  const completo = feitas === r.series.length;
  const ehAtual = atual?.ex === i;
  const antes = ultimaVez(r.exercicio_id, hist);
  return `<li class="exercicio ${completo ? 'completo' : ''} ${ehAtual ? 'atual' : ''}" id="ex-${i}">
    <details ${completo && !ehAtual ? '' : 'open'}>
      <summary class="exercicio-head">
        <span class="num-ex ${completo ? 'ok' : ''}" aria-hidden="true">${completo ? icon('check', { size: 16 }) : i + 1}</span>
        <span class="item-txt">
          <span class="exercicio-nome">${esc(r.nome)}</span>
          <span class="item-meta">${grupoTag(r.grupo)}<span class="muted small">${feitas}/${r.series.length} séries</span>${ehAtual ? `<span class="selo agora">Agora: série ${atual.serie + 1}</span>` : ''}</span>
        </span>
      </summary>
      <div class="exercicio-corpo">
        <p class="alvo-linha">
          <span><strong>Meta:</strong> ${r.series.length} × ${esc(r.reps_alvo || '—')}${r.carga_alvo ? ` · ${esc(r.carga_alvo)}` : ''} · descanso ${fmtDescanso(r.descanso_s)}</span>
          ${botaoVideo(ex)}
        </p>
        ${animacaoMini(ex)}
        ${r.obs ? `<p class="obs">${esc(r.obs)}</p>` : ''}
        ${antes ? `<p class="ultima">${icon('history', { size: 14 })}Última vez: ${esc(textoSeries(antes.series))}</p>` : ''}
        <div class="series-head" aria-hidden="true"><span>Série</span><span>Carga</span><span>Reps</span><span>Feita</span></div>
        <ol class="series">${r.series.map((s, j) => linhaSerie(s, i, j, atual)).join('')}</ol>
        <div class="series-acoes">
          <button type="button" class="btn link small" data-mais-serie>${icon('plus', { size: 16 })}Série</button>
          <button type="button" class="btn link small" data-menos-serie ${r.series.length <= 1 ? 'disabled' : ''}>${icon('minus', { size: 16 })}Série</button>
          <button type="button" class="btn link small" data-descansar>${icon('timer', { size: 16 })}Descansar ${fmtDescanso(r.descanso_s)}</button>
        </div>
      </div>
    </details>
  </li>`;
}

export function render() {
  const s = sessao.ativa();
  if (!s) {
    return emptyState({ title: 'Nenhum treino em andamento', text: 'Escolha uma ficha e toque em “Começar treino”.', action: '<a class="btn primary" href="#/inicio">Ver minhas fichas</a>' });
  }
  const atual = proximaSerie(s.registros);
  const r = resumoSessao(s.registros);
  // "Última vez" sem contar a própria sessão (ela ainda não está no histórico, mas por garantia).
  const hist = sessoesDe(eu()).filter((x) => x.id !== s.id);
  const pct = r.total ? Math.round((r.feitas / r.total) * 100) : 0;
  return `
    <header class="page-head treinar-head">
      <div><p class="page-kicker">${icon('timer', { size: 16 })}Treinando · <span id="cron-sessao" class="cron">${fmtCronometro((Date.now() - Date.parse(s.inicio)) / 1000)}</span></p>
        <h1 class="page-title">${esc(s.nome_treino)}</h1></div>
      <div class="head-actions"><button type="button" class="btn primary" data-concluir>${icon('flag', { size: 18 })}Concluir</button></div>
    </header>
    <div class="progresso" role="progressbar" aria-label="Séries feitas" aria-valuemin="0" aria-valuemax="${r.total}" aria-valuenow="${r.feitas}" aria-valuetext="${r.feitas} de ${r.total} séries">
      <span class="progresso-barra" style="width:${pct}%"></span>
    </div>
    <p class="progresso-txt"><strong>${r.feitas}</strong> de ${r.total} séries · ${r.exerciciosFeitos} de ${s.registros.length} exercícios${r.volume ? ` · ${fmtKg(r.volume)} kg` : ''}</p>
    ${atual ? '' : `<p class="callout good">Todas as séries feitas. ${icon('check', { size: 16 })} Toque em <strong>Concluir</strong> para salvar o treino.</p>`}
    <ol class="exercicios">${s.registros.map((reg, i) => cartaoExercicio(reg, i, atual, hist)).join('')}</ol>
    <div class="actions"><button type="button" class="btn link danger-text" data-descartar>Descartar treino</button>
      <button type="button" class="btn primary" data-concluir>${icon('flag', { size: 18 })}Concluir treino</button></div>`;
}

function dialogoConcluir() {
  const s = sessao.ativa();
  if (!s) return;
  const r = resumoSessao(s.registros);
  const faltam = r.total - r.feitas;
  const dur = fmtDuracao((Date.now() - Date.parse(s.inicio)) / 1000);
  const dlg = openDialog(`
    <form class="sheet-body" novalidate>
      ${sheetHeader('Concluir treino')}
      <dl class="mini-kpis">
        <div><dt>Duração</dt><dd>${dur}</dd></div>
        <div><dt>Séries</dt><dd>${r.feitas} de ${r.total}</dd></div>
        <div><dt>Volume</dt><dd>${r.volume ? `${fmtKg(r.volume)} kg` : '—'}</dd></div>
      </dl>
      ${faltam ? `<p class="callout alert">${plural(faltam, 'série ficou', 'séries ficaram')} sem marcar. Elas entram como não feitas.</p>` : ''}
      <fieldset class="segmented small esforco"><legend class="field-label">Como foi o treino?</legend>
        ${Object.entries(ESFORCO).map(([k, v]) => `<label><input type="radio" name="esforco" value="${k}" ${k === '3' ? 'checked' : ''}><span>${v}</span></label>`).join('')}
      </fieldset>
      <label class="field" for="cc-nota"><span class="field-label">Anotação para o personal <small>(opcional)</small></span>
        <textarea id="cc-nota" name="nota" rows="2" maxlength="2000" placeholder="Dor, ajuste de máquina, o que achou…"></textarea></label>
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Voltar ao treino</button>
        <button type="submit" class="btn primary">Salvar treino</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await enquanto(e.submitter, () => sessao.concluir({ esforco: f.esforco.value, nota: f.nota.value.trim() }));
    if (!res) return;
    dlg.close();
    if (res.enviado) toast('Treino salvo. Bom trabalho!');
    else if (navigator.onLine === false || /conexão|internet/i.test(res.erro?.message || '')) toast('Treino salvo no aparelho. Ele vai para o personal assim que a internet voltar.', { timeout: 8000 });
    else toast(`Treino salvo no aparelho, mas o envio falhou: ${esc(res.erro?.message || '')}. Tentaremos de novo.`, { tone: 'alert', timeout: 9000 });
    location.hash = `#/sessao/${res.linha.id}`;
  });
}

/** Lê o que está digitado na linha (para o ✓ gravar o valor mesmo sem sair do campo). */
function lerLinha(li) {
  const ex = Number(li.dataset.ex);
  const serie = Number(li.dataset.serie);
  for (const inp of li.querySelectorAll('input[data-campo]')) {
    const n = parseDecimal(inp.value);
    sessao.alterarSerie(ex, serie, inp.dataset.campo, inp.value.trim() === '' ? null : (Number.isFinite(n) ? n : null));
  }
  return { ex, serie };
}

export function mount(root) {
  clearInterval(relogio);
  const s = sessao.ativa();
  if (!s) return;
  sessao.religarTela();
  const cron = root.querySelector('#cron-sessao');
  relogio = setInterval(() => {
    if (!cron.isConnected) { clearInterval(relogio); return; }
    const a = sessao.ativa();
    if (a) cron.textContent = fmtCronometro((Date.now() - Date.parse(a.inicio)) / 1000);
  }, 1000);

  root.addEventListener('change', (e) => {
    const inp = e.target.closest('input[data-campo]');
    if (inp) lerLinha(inp.closest('.serie'));
  });
  // Enter no campo de reps marca a série (teclado numérico do celular: "concluído").
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('input[data-campo="reps"]');
    if (!inp) return;
    e.preventDefault();
    inp.closest('.serie').querySelector('[data-marcar]').click();
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const li = b.closest('.serie');
    const card = b.closest('.exercicio');
    const exIdx = card ? Number(card.id.slice(3)) : -1;
    if ('marcar' in b.dataset && li) {
      const { ex, serie } = lerLinha(li);
      const feita = b.getAttribute('aria-pressed') !== 'true';
      const novo = sessao.marcar(ex, serie, feita);
      if (feita && novo) {
        // Depois do redesenho, leva o aluno para onde ele está agora (próximo exercício, se mudou).
        const prox = proximaSerie(novo.registros);
        requestAnimationFrame(() => {
          if (prox && prox.ex !== ex) document.getElementById(`ex-${prox.ex}`)?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          if (!prox) document.querySelector('[data-concluir]')?.focus();
        });
      }
    } else if ('maisSerie' in b.dataset) sessao.adicionarSerie(exIdx);
    else if ('menosSerie' in b.dataset) sessao.removerSerie(exIdx);
    else if ('descansar' in b.dataset) sessao.iniciarDescanso(sessao.ativa().registros[exIdx].descanso_s, exIdx);
    else if ('concluir' in b.dataset) dialogoConcluir();
    else if ('descartar' in b.dataset) {
      const ok = await confirmDialog({ title: 'Descartar este treino?', text: 'As séries marcadas não vão para o histórico.', confirmLabel: 'Descartar', danger: true });
      if (ok) { sessao.descartar(); location.hash = '#/inicio'; toast('Treino descartado.'); }
    }
  });
}

