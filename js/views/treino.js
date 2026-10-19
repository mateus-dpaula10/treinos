// Ficha de treino (#/treino/<id>). Aluno: a ficha para ler, com vídeo de cada exercício e "Começar".
// Personal: o editor (exercícios, séries, reps, carga, descanso, observações), com rascunho até salvar.
import {
  state, ehStaff, eu, treino, exercicio, pessoa, sessoesDe, meusAlunos, salvarTreino, excluirTreino, copiarTreino,
} from '../store.js';
import { GRUPOS, DESCANSOS, fmtDescanso, novoItem, ultimaVez, textoSeries } from '../domain.js';
import { esc, normalize, plural, fmtDate } from '../utils.js';
import { emptyState, grupoTag, botaoVideo, toast, enquanto, confirmDialog, openDialog, sheetHeader } from '../ui.js';
import { icon } from '../icons.js';
import { textoResumo, ligarComecar, validadeBadge } from './comum.js';
import { abrirFormExercicio } from './exercicios.js';

// ---------- Aluno: ler a ficha ----------

function alvo(item) {
  return [`${item.series} × ${esc(item.reps || '—')}`, item.carga ? esc(item.carga) : '', `descanso ${fmtDescanso(item.descanso_s)}`].filter(Boolean).join(' · ');
}

function renderLeitura(t) {
  const hist = sessoesDe(eu());
  return `
    <a class="voltar" href="#/inicio">${icon('back', { size: 18 })}Hoje</a>
    <header class="page-head">
      <div><h1 class="page-title">${esc(t.nome)}</h1><p class="page-sub">${textoResumo(t.itens)}</p>
      <p class="item-meta">${validadeBadge(t)}${t.validade && !validadeBadge(t) ? `<span class="muted small">Válida até ${esc(fmtDate(t.validade))}</span>` : ''}</p></div>
    </header>
    ${t.observacoes ? `<p class="callout info obs-ficha">${esc(t.observacoes)}</p>` : ''}
    <ol class="exercicios-ficha">
      ${(t.itens || []).map((item, i) => {
        const ex = exercicio(item.exercicio_id);
        const antes = ultimaVez(item.exercicio_id, hist);
        return `<li class="block exercicio-ficha">
          <span class="num-ex" aria-hidden="true">${i + 1}</span>
          <div class="exercicio-txt">
            <h2 class="exercicio-nome">${esc(ex?.nome || 'Exercício removido')}</h2>
            <p class="item-meta">${ex ? grupoTag(ex.grupo) : ''}<span class="alvo">${alvo(item)}</span></p>
            ${item.obs ? `<p class="obs">${esc(item.obs)}</p>` : ''}
            ${antes ? `<p class="ultima">${icon('history', { size: 14 })}Última vez: ${esc(textoSeries(antes.series))}</p>` : ''}
          </div>
          ${botaoVideo(ex)}
        </li>`;
      }).join('')}
    </ol>
    <div class="barra-acao"><button type="button" class="btn primary grande block" data-comecar="${t.id}">${icon('play', { size: 20 })}Começar treino</button></div>`;
}

// ---------- Personal: editor ----------

const rascunhos = new Map(); // id → { ...campos editáveis, mudou }

function rascunhoDe(t) {
  if (!rascunhos.has(t.id)) {
    rascunhos.set(t.id, {
      nome: t.nome, aluno: t.aluno, observacoes: t.observacoes || '', validade: t.validade || '', ativo: t.ativo,
      itens: structuredClone(t.itens || []), mudou: false,
    });
  }
  return rascunhos.get(t.id);
}

export const temAlteracoes = () => [...rascunhos.values()].some((r) => r.mudou);

function voltarPara(t) {
  return t.aluno ? { href: `#/aluno/${encodeURIComponent(t.aluno)}`, label: pessoa(t.aluno)?.nome || 'Aluno' } : { href: '#/modelos', label: 'Modelos' };
}

const opcoesDescanso = (v) => {
  const lista = DESCANSOS.includes(Number(v)) ? DESCANSOS : [...DESCANSOS, Number(v)].sort((a, b) => a - b);
  return lista.map((s) => `<option value="${s}" ${Number(v) === s ? 'selected' : ''}>${fmtDescanso(s)}</option>`).join('');
};

function itemEditor(item, i, n) {
  const ex = exercicio(item.exercicio_id);
  const id = (c) => `it-${item.id}-${c}`;
  return `<li class="item-ficha" data-i="${i}">
    <div class="item-ficha-head">
      <span class="num-ex" aria-hidden="true">${i + 1}</span>
      <span class="item-txt"><strong>${esc(ex?.nome || 'Exercício removido')}</strong><span class="item-meta">${ex ? grupoTag(ex.grupo) : ''}</span></span>
      ${botaoVideo(ex, { classe: 'icon-btn small' })}
      <button type="button" class="icon-btn small" data-mover="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(ex?.nome || '')}">${icon('up', { size: 18 })}</button>
      <button type="button" class="icon-btn small" data-mover="1" ${i === n - 1 ? 'disabled' : ''} aria-label="Descer ${esc(ex?.nome || '')}">${icon('down', { size: 18 })}</button>
      <button type="button" class="icon-btn small danger-text" data-remover-item aria-label="Tirar ${esc(ex?.nome || '')} da ficha">${icon('trash', { size: 18 })}</button>
    </div>
    <div class="item-ficha-campos">
      <label class="field" for="${id('s')}"><span class="field-label">Séries</span>
        <input id="${id('s')}" data-item-campo="series" type="number" inputmode="numeric" min="1" max="20" value="${esc(item.series)}" data-nao-suja></label>
      <label class="field" for="${id('r')}"><span class="field-label">Reps</span>
        <input id="${id('r')}" data-item-campo="reps" maxlength="20" value="${esc(item.reps)}" placeholder="10-12" data-nao-suja></label>
      <label class="field" for="${id('c')}"><span class="field-label">Carga</span>
        <input id="${id('c')}" data-item-campo="carga" maxlength="30" value="${esc(item.carga)}" placeholder="20 kg" data-nao-suja></label>
      <label class="field" for="${id('d')}"><span class="field-label">Descanso</span>
        <select id="${id('d')}" data-item-campo="descanso_s" data-nao-suja>${opcoesDescanso(item.descanso_s)}</select></label>
    </div>
    <label class="field obs-campo" for="${id('o')}"><span class="sr-only">Observação</span>
      <input id="${id('o')}" data-item-campo="obs" maxlength="300" value="${esc(item.obs)}" placeholder="Observação (técnica, cadência, bi-set com o próximo…)" data-nao-suja></label>
  </li>`;
}

function renderEditor(t) {
  const r = rascunhoDe(t);
  const volta = voltarPara(t);
  const alunos = meusAlunos();
  return `
    <a class="voltar" href="${volta.href}">${icon('back', { size: 18 })}${esc(volta.label)}</a>
    <header class="page-head">
      <div><p class="page-kicker">${t.aluno ? 'Ficha do aluno' : 'Modelo'}</p><h1 class="page-title" id="titulo-ficha">${esc(r.nome)}</h1>
      <p class="page-sub" id="resumo-ficha">${textoResumo(r.itens)}</p></div>
      <div class="head-actions">
        <button type="button" class="btn ghost small" data-copiar>${icon('copy', { size: 18 })}<span class="only-desktop">Copiar</span></button>
        <button type="button" class="icon-btn danger-text" data-excluir aria-label="Excluir ficha">${icon('trash')}</button>
      </div>
    </header>

    <section class="block" aria-labelledby="h-dados">
      <div class="block-head"><h2 id="h-dados">Dados da ficha</h2></div>
      <div class="grid-2">
        <label class="field" for="tf-nome"><span class="field-label">Nome</span>
          <input id="tf-nome" data-campo="nome" maxlength="80" value="${esc(r.nome)}" required placeholder="Treino A · Peito e tríceps" data-nao-suja></label>
        <label class="field" for="tf-aluno"><span class="field-label">Aluno</span>
          <select id="tf-aluno" data-campo="aluno" data-nao-suja>
            <option value="" ${!r.aluno ? 'selected' : ''}>Nenhum (modelo)</option>
            ${alunos.map((a) => `<option value="${esc(a.email)}" ${r.aluno === a.email ? 'selected' : ''}>${esc(a.nome || a.email)}</option>`).join('')}
            ${r.aluno && !alunos.some((a) => a.email === r.aluno) ? `<option value="${esc(r.aluno)}" selected>${esc(r.aluno)}</option>` : ''}
          </select></label>
        <label class="field" for="tf-validade"><span class="field-label">Válida até <small>(opcional)</small></span>
          <input id="tf-validade" data-campo="validade" type="date" value="${esc(r.validade)}" data-nao-suja></label>
        <label class="check campo-ativo"><input type="checkbox" data-campo="ativo" ${r.ativo ? 'checked' : ''} data-nao-suja>
          <span>Ativa <small>(desmarcada, some do rodízio do aluno)</small></span></label>
      </div>
      <label class="field" for="tf-obs"><span class="field-label">Observações para o aluno</span>
        <textarea id="tf-obs" data-campo="observacoes" rows="2" maxlength="4000" placeholder="Aquecimento, cardio no fim, cuidados…" data-nao-suja>${esc(r.observacoes)}</textarea></label>
    </section>

    <section class="block" aria-labelledby="h-itens">
      <div class="block-head"><h2 id="h-itens">Exercícios</h2>
        <button type="button" class="btn primary small" data-adicionar>${icon('plus', { size: 18 })}Adicionar</button></div>
      ${r.itens.length ? `<ol class="itens-ficha">${r.itens.map((it, i) => itemEditor(it, i, r.itens.length)).join('')}</ol>
        <div class="actions left"><button type="button" class="btn ghost" data-adicionar>${icon('plus', { size: 18 })}Adicionar exercício</button></div>`
        : emptyState({ title: 'Ficha vazia', text: 'Adicione os exercícios da biblioteca. Depois ajuste séries, repetições, carga e descanso de cada um.' })}
    </section>

    <div class="barra-salvar ${r.mudou ? 'suja' : ''}" id="barra-salvar">
      <span class="barra-salvar-txt" aria-live="polite">${r.mudou ? 'Alterações não salvas' : 'Tudo salvo'}</span>
      <button type="button" class="btn link small" data-desfazer ${r.mudou ? '' : 'hidden'}>Desfazer</button>
      <button type="button" class="btn primary" data-salvar>Salvar ficha</button>
    </div>`;
}

function marcarSujo(root, r) {
  r.mudou = true;
  const barra = root.querySelector('#barra-salvar');
  barra.classList.add('suja');
  barra.querySelector('.barra-salvar-txt').textContent = 'Alterações não salvas';
  barra.querySelector('[data-desfazer]').hidden = false;
}

/** Escolher exercícios da biblioteca (vários de uma vez). */
function escolherExercicios(aoEscolher) {
  const marcados = new Set();
  let grupo = '';
  let busca = '';
  const lista = () => state.exercicios.filter((e) => (!grupo || e.grupo === grupo) && (!busca || normalize(`${e.nome} ${e.equipamento}`).includes(busca)));
  const dlg = openDialog(`
    <div class="sheet-body">
      ${sheetHeader('Adicionar exercícios')}
      <div class="filtros">
        <label class="busca">${icon('search', { size: 18 })}<span class="sr-only">Buscar</span><input type="search" id="pk-busca" placeholder="Buscar exercício…" autofocus></label>
        <label><span class="sr-only">Grupo</span><select class="compact" id="pk-grupo"><option value="">Todos os grupos</option>
          ${Object.entries(GRUPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      </div>
      <ul class="picker" id="pk-lista"></ul>
      <div class="actions">
        <button type="button" class="btn link" data-novo-ex>${icon('plus', { size: 16 })}Exercício novo</button>
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="button" class="btn primary" data-ok disabled>Adicionar</button>
      </div>
    </div>`, { classe: 'sheet-largo' });
  const ul = dlg.querySelector('#pk-lista');
  const ok = dlg.querySelector('[data-ok]');
  const desenhar = () => {
    const l = lista();
    ul.innerHTML = l.length ? l.map((e) => `<li><label class="check picker-item">
      <input type="checkbox" value="${e.id}" ${marcados.has(e.id) ? 'checked' : ''}>
      <span class="item-txt"><strong>${esc(e.nome)}</strong><span class="item-meta">${grupoTag(e.grupo)}${e.equipamento ? `<span class="muted small">${esc(e.equipamento)}</span>` : ''}${e.video_url ? `<span class="muted small">${icon('play', { size: 12 })}vídeo</span>` : ''}</span></span>
    </label></li>`).join('') : '<li class="muted">Nada encontrado. Crie em “Exercício novo”.</li>';
    ok.disabled = !marcados.size;
    ok.textContent = marcados.size ? `Adicionar ${marcados.size}` : 'Adicionar';
  };
  desenhar();
  dlg.querySelector('#pk-busca').addEventListener('input', (e) => { busca = normalize(e.target.value); desenhar(); });
  dlg.querySelector('#pk-grupo').addEventListener('change', (e) => { grupo = e.target.value; desenhar(); });
  ul.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    if (e.target.checked) marcados.add(e.target.value); else marcados.delete(e.target.value);
    ok.disabled = !marcados.size;
    ok.textContent = marcados.size ? `Adicionar ${marcados.size}` : 'Adicionar';
  });
  ok.addEventListener('click', () => {
    // Na ordem em que aparecem na lista (e não na ordem dos cliques).
    const ids = state.exercicios.filter((e) => marcados.has(e.id)).map((e) => e.id);
    dlg.close();
    aoEscolher(ids);
  });
  dlg.querySelector('[data-novo-ex]').addEventListener('click', () => {
    abrirFormExercicio(null, { aoSalvar: (novo) => aoEscolher([novo.id]) });
  });
}

function dialogoCopiar(t) {
  const alunos = meusAlunos();
  const dlg = openDialog(`
    <form class="sheet-body" novalidate>
      ${sheetHeader('Copiar ficha')}
      <p class="muted">Cria uma ficha nova, independente desta, com os mesmos exercícios.</p>
      <label class="field" for="cp-para"><span class="field-label">Para</span>
        <select id="cp-para" name="para"><option value="">Modelos (sem aluno)</option>
          ${alunos.map((a) => `<option value="${esc(a.email)}">${esc(a.nome || a.email)}</option>`).join('')}</select></label>
      <label class="field" for="cp-nome"><span class="field-label">Nome da cópia</span><input id="cp-nome" name="nome" maxlength="80" value="${esc(t.nome)}" required></label>
      <div class="actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Copiar</button></div>
    </form>`);
  const f = dlg.querySelector('form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nova = await enquanto(e.submitter, () => copiarTreino(t.id, f.para.value || null, { nome: f.nome.value.trim() || t.nome }));
    if (nova) { dlg.close(); toast('Ficha copiada.'); location.hash = `#/treino/${nova.id}`; }
  });
}

function montarEditor(root, t, ctx) {
  const r = rascunhoDe(t);
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.campo) {
      r[el.dataset.campo] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.campo === 'nome') root.querySelector('#titulo-ficha').textContent = el.value || 'Sem nome';
      marcarSujo(root, r);
    } else if (el.dataset.itemCampo) {
      const i = Number(el.closest('[data-i]').dataset.i);
      const campo = el.dataset.itemCampo;
      r.itens[i][campo] = campo === 'series' || campo === 'descanso_s' ? Number(el.value) || 0 : el.value;
      if (campo === 'series' || campo === 'descanso_s') root.querySelector('#resumo-ficha').textContent = textoResumo(r.itens);
      marcarSujo(root, r);
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const li = b.closest('[data-i]');
    const i = li ? Number(li.dataset.i) : -1;
    if ('mover' in b.dataset && li) {
      const j = i + Number(b.dataset.mover);
      [r.itens[i], r.itens[j]] = [r.itens[j], r.itens[i]];
      r.mudou = true;
      ctx.rerender();
      document.querySelector(`[data-i="${j}"] [data-mover="${b.dataset.mover}"]`)?.focus();
    } else if ('removerItem' in b.dataset && li) {
      const [tirado] = r.itens.splice(i, 1);
      r.mudou = true;
      ctx.rerender();
      toast(`${esc(exercicio(tirado.exercicio_id)?.nome || 'Exercício')} saiu da ficha.`, { action: { label: 'Desfazer', run: () => { r.itens.splice(i, 0, tirado); ctx.rerender(); } } });
    } else if ('adicionar' in b.dataset) {
      escolherExercicios((ids) => {
        r.itens.push(...ids.map((id) => novoItem(id)));
        r.mudou = true;
        ctx.rerender();
        toast(`${plural(ids.length, 'exercício adicionado', 'exercícios adicionados')}. Ajuste séries e descanso.`);
      });
    } else if ('desfazer' in b.dataset) {
      rascunhos.delete(t.id);
      ctx.rerender();
    } else if ('salvar' in b.dataset) {
      const nome = r.nome.trim();
      if (!nome) { toast('Dê um nome para a ficha.', { tone: 'alert' }); root.querySelector('#tf-nome').focus(); return; }
      const itens = r.itens.map((it) => ({ ...it, series: Math.max(1, Math.min(20, Number(it.series) || 1)), reps: String(it.reps || '').trim(), carga: String(it.carga || '').trim(), obs: String(it.obs || '').trim() }));
      const salvo = await enquanto(b, () => salvarTreino({ id: t.id, nome, aluno: r.aluno || null, observacoes: r.observacoes.trim(), validade: r.validade || null, ativo: r.ativo, itens }));
      if (salvo) {
        rascunhos.delete(t.id);
        toast(salvo.aluno ? `Ficha salva. ${esc(pessoa(salvo.aluno)?.nome || 'O aluno')} já vê a versão nova.` : 'Modelo salvo.');
        ctx.rerender();
      }
    } else if ('copiar' in b.dataset) {
      if (r.mudou) { toast('Salve a ficha antes de copiar.', { tone: 'alert' }); return; }
      dialogoCopiar(t);
    } else if ('excluir' in b.dataset) {
      const ok = await confirmDialog({
        title: `Excluir “${esc(t.nome)}”?`,
        text: t.aluno ? 'O aluno deixa de ver esta ficha. Os treinos já feitos continuam no histórico. Para só tirar do rodízio, desmarque “Ativa”.' : 'O modelo é apagado. As fichas já copiadas dele não mudam.',
        confirmLabel: 'Excluir', danger: true,
      });
      if (!ok) return;
      const volta = voltarPara(t);
      if (await enquanto(b, async () => { await excluirTreino(t.id); return true; })) {
        rascunhos.delete(t.id);
        location.hash = volta.href;
        toast('Ficha excluída.');
      }
    }
  });
}

// ---------- Rota ----------

export function render({ sub }) {
  const t = treino(sub);
  if (!t) return emptyState({ title: 'Ficha não encontrada', text: 'Ela pode ter sido excluída.', action: '<a class="btn ghost small" href="#/inicio">Voltar ao início</a>' });
  return ehStaff() ? renderEditor(t) : renderLeitura(t);
}

export function mount(root, ctx) {
  const t = treino(ctx.sub);
  if (!t) return;
  if (ehStaff()) montarEditor(root, t, ctx); else ligarComecar(root);
}
