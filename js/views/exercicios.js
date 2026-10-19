// Biblioteca de exercícios: todos veem (com o vídeo de demonstração); admin e personal cadastram e editam.
import { state, ehStaff, salvarExercicio, excluirExercicio, fichasComExercicio, exercicio } from '../store.js';
import { GRUPOS, embedVideo } from '../domain.js';
import { esc, normalize, plural } from '../utils.js';
import { emptyState, grupoTag, openDialog, sheetHeader, toast, enquanto, confirmDialog } from '../ui.js';
import { icon } from '../icons.js';

const filtro = { busca: '', grupo: '' };

function passa(e) {
  if (filtro.grupo && e.grupo !== filtro.grupo) return false;
  if (filtro.busca && !normalize(`${e.nome} ${e.equipamento} ${GRUPOS[e.grupo]}`).includes(normalize(filtro.busca))) return false;
  return true;
}

function linha(e, staff) {
  const v = embedVideo(e.video_url);
  return `<li class="ex-linha" data-busca="${esc(normalize(`${e.nome} ${e.equipamento} ${GRUPOS[e.grupo]}`))}" data-grupo="${esc(e.grupo)}">
    <button type="button" class="ex-abrir" data-video="${e.id}" aria-label="${e.video_url ? 'Ver vídeo' : 'Como fazer'}: ${esc(e.nome)}">
      <span class="ex-thumb ${v?.thumb ? '' : 'vazio'}">${v?.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : ''}${icon(e.video_url ? 'play' : 'dumbbell', { size: 20 })}</span>
      <span class="item-txt"><strong>${esc(e.nome)}</strong>
        <span class="item-meta">${grupoTag(e.grupo)}${e.equipamento ? `<span class="muted small">${esc(e.equipamento)}</span>` : ''}${e.video_url ? '' : '<span class="muted small">sem vídeo</span>'}</span></span>
    </button>
    ${staff ? `<button type="button" class="icon-btn small" data-editar="${e.id}" aria-label="Editar ${esc(e.nome)}">${icon('edit', { size: 18 })}</button>` : ''}
  </li>`;
}

export function render() {
  const staff = ehStaff();
  const lista = state.exercicios.filter(passa);
  const semVideo = state.exercicios.filter((e) => !e.video_url).length;
  return `
    <header class="page-head">
      <div><h1 class="page-title">Exercícios</h1><p class="page-sub" id="ex-total">${plural(lista.length, 'exercício', 'exercícios')}${staff && semVideo ? ` · ${semVideo} sem vídeo` : ''}</p></div>
      ${staff ? `<div class="head-actions"><button type="button" class="btn primary only-desktop" data-novo>${icon('plus')}Novo exercício</button></div>` : ''}
    </header>
    <div class="filtros" role="search">
      <label class="busca">${icon('search', { size: 18 })}<span class="sr-only">Buscar</span>
        <input type="search" id="ex-busca" placeholder="Buscar por nome ou aparelho…" value="${esc(filtro.busca)}" data-nao-suja></label>
      <label><span class="sr-only">Grupo muscular</span><select class="compact" id="ex-grupo" data-nao-suja><option value="">Todos os grupos</option>
        ${Object.entries(GRUPOS).map(([k, v]) => `<option value="${k}" ${filtro.grupo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    ${state.exercicios.length ? `<ul class="ex-lista" id="ex-lista">${state.exercicios.map((e) => linha(e, staff)).join('')}</ul>
      <p class="muted" id="ex-vazio" ${lista.length ? 'hidden' : ''}>Nada encontrado com esse filtro.</p>`
      : emptyState({ title: 'Biblioteca vazia', text: staff ? 'Cadastre os exercícios da academia, com o link do vídeo de demonstração.' : 'Seu personal ainda não cadastrou exercícios.' })}`;
}

/** Formulário de exercício (novo ou editar). aoSalvar(linha) é chamado depois de gravar. */
export function abrirFormExercicio(e, { aoSalvar } = {}) {
  const dlg = openDialog(`
    <form class="sheet-body" novalidate>
      ${sheetHeader(e ? 'Editar exercício' : 'Novo exercício')}
      <label class="field" for="ef-nome"><span class="field-label">Nome</span><input id="ef-nome" name="nome" maxlength="120" required value="${esc(e?.nome || '')}" autofocus placeholder="Supino reto com barra"></label>
      <div class="grid-2">
        <label class="field" for="ef-grupo"><span class="field-label">Grupo muscular</span><select id="ef-grupo" name="grupo">
          ${Object.entries(GRUPOS).map(([k, v]) => `<option value="${k}" ${(e?.grupo || 'peito') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field" for="ef-equip"><span class="field-label">Aparelho <small>(opcional)</small></span><input id="ef-equip" name="equipamento" maxlength="60" value="${esc(e?.equipamento || '')}" placeholder="Máquina, halteres, polia…"></label>
      </div>
      <label class="field" for="ef-video"><span class="field-label">Vídeo de demonstração <small>(YouTube, Vimeo ou link de GIF/MP4)</small></span>
        <input id="ef-video" name="video" type="url" inputmode="url" maxlength="500" value="${esc(e?.video_url || '')}" placeholder="https://www.youtube.com/watch?v=…" spellcheck="false">
        <span class="field-hint" id="ef-video-dica" aria-live="polite"></span></label>
      <label class="field" for="ef-instr"><span class="field-label">Como fazer <small>(aparece para o aluno junto do vídeo)</small></span>
        <textarea id="ef-instr" name="instrucoes" rows="4" maxlength="4000">${esc(e?.instrucoes || '')}</textarea></label>
      <div class="actions">
        ${e ? '<button type="button" class="btn link danger-text" data-apagar>Excluir</button>' : ''}
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary">Salvar</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  const dica = dlg.querySelector('#ef-video-dica');
  const conferir = () => {
    const url = f.video.value.trim();
    const v = embedVideo(url);
    dica.textContent = !url ? 'Shorts, youtu.be, vídeos não listados e links diretos de .gif/.webp/.mp4 também servem.'
      : v?.embed ? `${v.tipo === 'youtube' ? 'YouTube' : 'Vimeo'} reconhecido: o vídeo toca dentro do app.`
        : v ? `${v.tipo === 'imagem' ? 'Imagem/GIF' : 'Vídeo'} direto: aparece em loop, sem som, inclusive na tela do treino.`
        : /^https:\/\//i.test(url) ? 'Link de outro site: o aluno vai abrir em outra aba.' : 'O link precisa começar com https://';
  };
  conferir();
  f.video.addEventListener('input', conferir);
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nome = f.nome.value.trim();
    const video = f.video.value.trim();
    if (!nome) { toast('Dê um nome para o exercício.', { tone: 'alert' }); f.nome.focus(); return; }
    if (video && !/^https:\/\//i.test(video)) { toast('O link do vídeo precisa começar com https://', { tone: 'alert' }); f.video.focus(); return; }
    const linhaSalva = await enquanto(ev.submitter, () => salvarExercicio({
      ...(e ? { id: e.id } : {}), nome, grupo: f.grupo.value, equipamento: f.equipamento.value.trim(), video_url: video, instrucoes: f.instrucoes.value.trim(),
    }));
    if (linhaSalva) { dlg.close(); toast(e ? 'Exercício salvo.' : 'Exercício criado.'); aoSalvar?.(linhaSalva); }
  });
  dlg.querySelector('[data-apagar]')?.addEventListener('click', async () => {
    const usos = fichasComExercicio(e.id);
    const ok = await confirmDialog({
      title: `Excluir ${esc(e.nome)}?`,
      text: usos.length ? `Ele está em ${plural(usos.length, 'ficha', 'fichas')} e vai aparecer lá como “Exercício removido”. O histórico dos alunos não muda.` : 'Nenhuma ficha usa este exercício.',
      confirmLabel: 'Excluir', danger: true,
    });
    if (ok && await enquanto(null, async () => { await excluirExercicio(e.id); return true; })) toast('Exercício excluído.');
  });
}

export function mount(root) {
  const busca = root.querySelector('#ex-busca');
  const grupo = root.querySelector('#ex-grupo');
  // Filtra sem redesenhar (não tira o cursor de quem digita).
  const aplicar = () => {
    filtro.busca = busca.value;
    filtro.grupo = grupo.value;
    const q = normalize(filtro.busca);
    let n = 0;
    root.querySelectorAll('.ex-linha').forEach((li) => {
      const ok = (!filtro.grupo || li.dataset.grupo === filtro.grupo) && (!q || li.dataset.busca.includes(q));
      li.hidden = !ok;
      if (ok) n++;
    });
    const vazio = root.querySelector('#ex-vazio');
    if (vazio) vazio.hidden = n > 0;
    root.querySelector('#ex-total').textContent = plural(n, 'exercício', 'exercícios');
  };
  busca.addEventListener('input', aplicar);
  grupo.addEventListener('change', aplicar);
  if (filtro.busca || filtro.grupo) aplicar();
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.editar) abrirFormExercicio(exercicio(b.dataset.editar));
    else if ('novo' in b.dataset) abrirFormExercicio(null);
  });
}

