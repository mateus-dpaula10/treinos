// Modelos: fichas sem aluno, para o personal copiar e ajustar (iniciante, hipertrofia ABC, emagrecimento…).
import { modelos, salvarTreino } from '../store.js';
import { esc, plural } from '../utils.js';
import { emptyState, enquanto } from '../ui.js';
import { icon } from '../icons.js';
import { textoResumo } from './comum.js';

export function render() {
  const lista = modelos();
  return `
    <header class="page-head">
      <div><h1 class="page-title">Modelos</h1><p class="page-sub">${plural(lista.length, 'modelo', 'modelos')} · fichas prontas para copiar para os alunos</p></div>
      <div class="head-actions"><button type="button" class="btn primary" data-novo>${icon('plus')}<span>Novo modelo</span></button></div>
    </header>
    <section class="block">
      ${lista.length ? `<ul class="lista-simples">${lista.map((t) => `<li>
        <span class="num-ex" aria-hidden="true">${icon('list', { size: 16 })}</span>
        <a class="lista-txt link-forte" href="#/treino/${t.id}"><strong>${esc(t.nome)}</strong><span class="muted small">${textoResumo(t.itens)}</span></a>
        <a class="icon-btn small" href="#/treino/${t.id}" aria-label="Editar ${esc(t.nome)}">${icon('edit', { size: 18 })}</a>
      </li>`).join('')}</ul>
      <p class="field-hint">Para passar a um aluno: abra o modelo e use “Copiar”, ou na página do aluno use “Usar modelo”.</p>`
        : emptyState({ title: 'Nenhum modelo', text: 'Monte uma vez as fichas que você mais usa e copie para cada aluno novo.' })}
    </section>`;
}

export function mount(root) {
  root.querySelector('[data-novo]').addEventListener('click', async (e) => {
    const nova = await enquanto(e.currentTarget, () => salvarTreino({ aluno: null, nome: 'Modelo · Novo', ordem: 0, ativo: true, observacoes: '', validade: null, itens: [] }));
    if (nova) location.hash = `#/treino/${nova.id}`;
  });
}
