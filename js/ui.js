// Peças de interface compartilhadas: avisos (toasts), diálogos, vídeo do exercício e pedaços de HTML repetidos.
import { esc, iniciais } from './utils.js';
import { icon } from './icons.js';
import { GRUPOS, embedVideo } from './domain.js';

// Rascunho: valores digitados e ainda não salvos na tela atual (id do campo → valor). Sobrevivem aos
// redesenhos (o personal mudou a ficha, uma série foi marcada) e são descartados ao trocar de tela.
// Depois de salvar um formulário, chame limparRascunho(form).
export const rascunho = new Map();
export function limparRascunho(form) {
  form.querySelectorAll('[id]').forEach((el) => rascunho.delete(el.id));
}

export function toast(message, { tone = 'info', action, timeout = 4500 } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.innerHTML = `<span>${message}</span>`;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { action.run(); el.remove(); });
    el.appendChild(btn);
  }
  root.appendChild(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

/** Abre um <dialog> genérico com o HTML informado. Retorna o elemento. */
export function openDialog(html, { id = 'generic-dialog', onClose, classe = '' } = {}) {
  const dlg = document.getElementById(id);
  if (!dlg._wired) {
    // Um único ouvinte permanente; o handler da vez fica em dlg._onClose. O evento 'close' chega depois
    // (tarefa na fila): se o diálogo já foi reaberto com outro conteúdo, o evento atrasado é ignorado.
    dlg.addEventListener('close', () => {
      if (dlg.open) return;
      const fn = dlg._onClose; dlg._onClose = null; fn?.();
    });
    dlg._wired = true;
  }
  if (dlg._onClose) { const prev = dlg._onClose; dlg._onClose = null; prev(); }
  dlg._onClose = onClose || null;
  dlg.className = `sheet ${classe}`.trim();
  dlg.innerHTML = html;
  const close = () => dlg.close();
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  dlg.onclick = (e) => { if (e.target === dlg) close(); };
  if (!dlg.open) dlg.showModal();
  const first = dlg.querySelector('[autofocus]') || dlg.querySelector('input, select, textarea, button:not([data-close])');
  first?.focus();
  return dlg;
}

export function sheetHeader(title, id = 'generic-dialog-title') {
  return `<header class="sheet-head">
    <h2 id="${id}">${esc(title)}</h2>
    <button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button>
  </header>`;
}

/** Confirmação acessível (substitui window.confirm). */
export function confirmDialog({ title, text, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const dlg = openDialog(`
      <form method="dialog" class="sheet-body confirm">
        ${sheetHeader(title)}
        <p>${text}</p>
        <div class="actions">
          <button type="button" class="btn ghost" data-close ${danger ? 'autofocus' : ''}>Cancelar</button>
          <button type="submit" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel)}</button>
        </div>
      </form>`, { onClose: () => resolve(answer) });
    dlg.querySelector('[data-ok]').addEventListener('click', () => { answer = true; });
  });
}

export function emptyState({ title, text, action }) {
  return `<div class="empty">
    <p class="empty-title">${esc(title)}</p>
    <p>${text}</p>
    ${action || ''}
  </div>`;
}

/** Trava o botão enquanto a ação roda e mostra o erro em toast. Devolve o resultado (ou undefined se falhou). */
export async function enquanto(botao, fn) {
  const antes = botao?.disabled;
  if (botao) { botao.disabled = true; botao.setAttribute('aria-busy', 'true'); }
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    toast(esc(err.message || 'Algo deu errado.'), { tone: 'alert', timeout: 7000 });
    return undefined;
  } finally {
    if (botao) { botao.disabled = antes; botao.removeAttribute('aria-busy'); }
  }
}

// ---------- Pedaços de HTML ----------

export const avatar = (nome, title = nome) => `<span class="avatar" title="${esc(title)}" aria-hidden="true">${esc(iniciais(nome))}</span>`;

export const grupoTag = (grupo) => `<span class="grupo grupo-${esc(grupo)}">${esc(GRUPOS[grupo] || grupo)}</span>`;

/** Botão "Ver vídeo" de um exercício (abre o diálogo pelo id). Sem vídeo, mostra "Como fazer". */
export function botaoVideo(ex, { classe = 'btn ghost small' } = {}) {
  if (!ex) return '';
  const tem = Boolean(ex.video_url);
  const soIcone = classe.includes('icon-btn');
  return `<button type="button" class="${classe}" data-video="${esc(ex.id)}" aria-label="${tem ? 'Ver vídeo' : 'Como fazer'}: ${esc(ex.nome)}">
    ${icon(tem ? 'play' : 'info', { size: soIcone ? 18 : 16 })}${soIcone ? '' : `<span>${tem ? 'Vídeo' : 'Como fazer'}</span>`}</button>`;
}

/** Diálogo com o vídeo de demonstração (YouTube/Vimeo tocam aqui dentro) e as instruções. */
export function abrirVideo(ex) {
  const v = embedVideo(ex.video_url);
  const player = v
    ? `<div class="player ${v.vertical ? 'vertical' : ''}"><iframe src="${esc(v.embed)}" title="Vídeo: ${esc(ex.nome)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe></div>`
    : ex.video_url
      ? `<p class="callout info">Esse link não toca aqui dentro. <a href="${esc(ex.video_url)}" target="_blank" rel="noopener noreferrer">Abrir o vídeo ${icon('external', { size: 14 })}</a></p>`
      : '<p class="callout info">Este exercício ainda não tem vídeo. O personal pode colocar um link do YouTube ou do Vimeo em Exercícios.</p>';
  const dlg = openDialog(`
    <div class="sheet-body">
      ${sheetHeader(ex.nome)}
      <p class="descanso-mini" data-descanso-mini hidden></p>
      <p class="item-meta">${grupoTag(ex.grupo)}${ex.equipamento ? `<span class="muted small">${esc(ex.equipamento)}</span>` : ''}</p>
      ${player}
      ${ex.instrucoes ? `<h3 class="sub-title">Como fazer</h3><p class="instrucoes">${esc(ex.instrucoes)}</p>` : ''}
      ${v ? `<p class="small"><a href="${esc(ex.video_url)}" target="_blank" rel="noopener noreferrer">Abrir no ${v.tipo === 'youtube' ? 'YouTube' : 'Vimeo'} ${icon('external', { size: 14 })}</a></p>` : ''}
    </div>`, {
    classe: 'sheet-video',
    // Fechar para o vídeo (senão o som continua tocando com o diálogo fechado).
    onClose: () => dlg.querySelector('iframe')?.remove(),
  });
}
