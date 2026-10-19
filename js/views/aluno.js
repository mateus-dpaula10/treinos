// Página do aluno (#/aluno/<email>), para o personal: dados e restrições, fichas (ordem do rodízio),
// histórico de treinos e evolução de carga.
import { pessoa, nomePessoa, ehAdmin, todasFichasDe, sessoesDe, modelos, salvarTreino, copiarTreino, moverTreino } from '../store.js';
import { diasTreinados } from '../domain.js';
import { esc, plural } from '../utils.js';
import { emptyState, avatar, toast, enquanto, openDialog, sheetHeader } from '../ui.js';
import { icon } from '../icons.js';
import { textoResumo, listaSessoes, tabelaProgresso, validadeBadge, quando } from './comum.js';
import { abrirEditarPessoa } from './pessoas.js';

const LETRAS = 'ABCDEFGHIJ';

/** Número para o wa.me: só dígitos, com o 55 do Brasil quando vier só DDD + número. */
const whats = (tel) => { const d = String(tel).replace(/\D/g, ''); return d.length <= 11 ? `55${d}` : d; };

function linhaFicha(t, i, n, sessoes) {
  const ultima = sessoes.find((s) => s.treino_id === t.id);
  return `<li class="${t.ativo ? '' : 'inativa'}">
    <span class="ordem">
      <button type="button" class="icon-btn small" data-mover="-1" data-id="${t.id}" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(t.nome)} no rodízio">${icon('up', { size: 16 })}</button>
      <button type="button" class="icon-btn small" data-mover="1" data-id="${t.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="Descer ${esc(t.nome)} no rodízio">${icon('down', { size: 16 })}</button>
    </span>
    <a class="lista-txt link-forte" href="#/treino/${t.id}"><strong>${esc(t.nome)}</strong>
      <span class="muted small">${textoResumo(t.itens)}${t.ativo ? '' : ' · inativa'}</span>
      <span class="item-meta">${ultima ? `<span class="muted small">Feito ${quando(ultima.inicio)}</span>` : '<span class="muted small">Ainda não feito</span>'}${validadeBadge(t)}</span></a>
    <a class="icon-btn small" href="#/treino/${t.id}" aria-label="Editar ${esc(t.nome)}">${icon('edit', { size: 18 })}</a>
  </li>`;
}

export function render({ sub }) {
  const a = pessoa(sub);
  if (!a || a.papel !== 'aluno') return emptyState({ title: 'Aluno não encontrado', text: 'Ele pode ter sido removido, ou é aluno de outro personal.', action: '<a class="btn ghost small" href="#/alunos">Ver alunos</a>' });
  const fichas = todasFichasDe(a.email).sort((x, y) => x.ordem - y.ordem);
  const ss = sessoesDe(a.email);
  return `
    <a class="voltar" href="#/alunos">${icon('back', { size: 18 })}Alunos</a>
    <header class="page-head">
      <div class="aluno-head">${avatar(a.nome || a.email)}
        <div><h1 class="page-title">${esc(a.nome || a.email)}</h1>
        <p class="page-sub">${esc(a.email)}${a.objetivo ? ` · ${esc(a.objetivo)}` : ''}${ehAdmin() ? ` · Personal: ${esc(a.personal ? nomePessoa(a.personal) : 'nenhum')}` : ''}</p></div></div>
      <div class="head-actions">
        ${a.telefone ? `<a class="btn ghost small" href="https://wa.me/${esc(whats(a.telefone))}" target="_blank" rel="noopener noreferrer">${icon('message', { size: 18 })}<span class="only-desktop">WhatsApp</span></a>` : ''}
        <button type="button" class="btn ghost small" data-editar>${icon('edit', { size: 18 })}<span class="only-desktop">Dados</span></button>
      </div>
    </header>

    ${a.notas ? `<p class="callout alert notas-aluno"><strong>Restrições:</strong> ${esc(a.notas)}</p>` : ''}

    <section class="kpis" aria-label="Frequência">
      <div class="kpi"><span class="kpi-label">Treinos em 7 dias</span><span class="kpi-valor">${diasTreinados(ss, { n: 7 })}</span></div>
      <div class="kpi"><span class="kpi-label">Em 30 dias</span><span class="kpi-valor">${diasTreinados(ss, { n: 30 })}</span></div>
      <div class="kpi"><span class="kpi-label">Último treino</span><span class="kpi-valor">${ss[0] ? quando(ss[0].inicio) : '—'}</span></div>
      <div class="kpi"><span class="kpi-label">Total</span><span class="kpi-valor">${ss.length}</span></div>
    </section>

    <section class="block" aria-labelledby="h-fichas">
      <div class="block-head"><h2 id="h-fichas">Fichas</h2>
        <span class="head-actions">
          ${modelos().length ? `<button type="button" class="btn ghost small" data-modelo>${icon('copy', { size: 16 })}Usar modelo</button>` : ''}
          <button type="button" class="btn primary small" data-nova>${icon('plus', { size: 16 })}Nova ficha</button></span></div>
      ${fichas.length ? `<ul class="lista-simples fichas-aluno">${fichas.map((t, i) => linhaFicha(t, i, fichas.length, ss)).join('')}</ul>
        <p class="field-hint">O aluno faz as fichas ativas em rodízio, nesta ordem (A → B → C → A…).</p>`
        : emptyState({ title: 'Sem ficha', text: `Monte a primeira ficha de ${esc((a.nome || '').split(' ')[0] || 'treino')}${modelos().length ? ' ou comece de um modelo' : ''}.` })}
    </section>

    <div class="cols">
      <section class="block" aria-labelledby="h-hist">
        <div class="block-head"><h2 id="h-hist">Treinos feitos</h2><span class="muted small">${plural(ss.length, 'treino', 'treinos')}</span></div>
        ${listaSessoes(ss, { limite: 20, vazio: { title: 'Ainda não treinou', text: 'Os treinos aparecem aqui assim que o aluno concluir, com carga e repetições de cada série.' } })}
      </section>
      <section class="block" aria-labelledby="h-evo">
        <div class="block-head"><h2 id="h-evo">Evolução de carga</h2></div>
        ${tabelaProgresso(ss)}
      </section>
    </div>`;
}

function dialogoModelo(email) {
  const lista = modelos();
  const dlg = openDialog(`
    <form class="sheet-body" novalidate>
      ${sheetHeader('Usar um modelo')}
      <p class="muted">A ficha do aluno nasce como cópia do modelo. Depois é só ajustar.</p>
      <fieldset class="opcoes-modelo"><legend class="sr-only">Modelo</legend>
        ${lista.map((t, i) => `<label class="check"><input type="radio" name="modelo" value="${t.id}" ${i === 0 ? 'checked' : ''}>
          <span><strong>${esc(t.nome)}</strong><br><small>${textoResumo(t.itens)}</small></span></label>`).join('')}
      </fieldset>
      <div class="actions"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Criar ficha</button></div>
    </form>`);
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = e.target.modelo.value;
    const nome = modelos().find((t) => t.id === id)?.nome.replace(/^Modelo\s*·\s*/i, '');
    const nova = await enquanto(e.submitter, () => copiarTreino(id, email, { nome }));
    if (nova) { dlg.close(); toast('Ficha criada a partir do modelo.'); location.hash = `#/treino/${nova.id}`; }
  });
}

export function mount(root, { sub }) {
  const a = pessoa(sub);
  if (!a) return;
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('editar' in b.dataset) abrirEditarPessoa(a, { aoRemover: () => { location.hash = '#/alunos'; } });
    else if ('modelo' in b.dataset) dialogoModelo(a.email);
    else if ('nova' in b.dataset) {
      const n = todasFichasDe(a.email).length;
      const nova = await enquanto(b, () => salvarTreino({
        aluno: a.email, nome: `Treino ${LETRAS[n] || n + 1}`, ordem: n, ativo: true, observacoes: '', validade: null, itens: [],
      }));
      if (nova) location.hash = `#/treino/${nova.id}`;
    } else if (b.dataset.mover) {
      await enquanto(b, () => moverTreino(b.dataset.id, Number(b.dataset.mover)));
    }
  });
}
