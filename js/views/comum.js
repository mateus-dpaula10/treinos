// Pedaços usados por várias telas: cartão de ficha, item de sessão, evolução de carga e "começar treino".
import { nomePessoa, treino } from '../store.js';
import { resumoTreino, fmtDuracao, fmtKg, ESFORCO, diasDesde, diaLocal, progressoCargas } from '../domain.js';
import { esc, fmtDate, fmtDateTime, plural, todayISO } from '../utils.js';
import { confirmDialog, emptyState, enquanto } from '../ui.js';
import { icon } from '../icons.js';
import * as sessao from '../sessao.js';

export const textoResumo = (itens) => {
  const r = resumoTreino(itens);
  return `${plural(r.exercicios, 'exercício', 'exercícios')} · ${plural(r.series, 'série', 'séries')} · ~${r.minutos} min`;
};

/** "hoje", "ontem", "há 5 dias". */
export function quando(ts) {
  const d = diasDesde(diaLocal(ts), todayISO());
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

/** Aviso de validade da ficha (vencida ou vencendo em até 7 dias). */
export function validadeBadge(t) {
  if (!t.validade) return '';
  const falta = -diasDesde(t.validade, todayISO());
  if (falta < 0) return `<span class="selo alerta">Vencida em ${esc(fmtDate(t.validade))}</span>`;
  if (falta <= 7) return `<span class="selo aviso">Vence ${falta === 0 ? 'hoje' : `em ${plural(falta, 'dia', 'dias')}`}</span>`;
  return '';
}

/** Ficha na lista do aluno: nome, resumo, última vez feita, Ver e Começar. */
export function cartaoFicha(t, { sessoes = [], destaque = false } = {}) {
  const ultima = sessoes.find((s) => s.treino_id === t.id);
  return `<li class="ficha ${destaque ? 'destaque' : ''}">
    <a class="ficha-link" href="#/treino/${t.id}">
      <span class="ficha-nome">${esc(t.nome)}</span>
      <span class="ficha-meta">${textoResumo(t.itens)}</span>
      <span class="item-meta">${ultima ? `<span class="muted small">Feito ${quando(ultima.inicio)}</span>` : '<span class="muted small">Ainda não feito</span>'}${validadeBadge(t)}</span>
    </a>
    <button type="button" class="btn ${destaque ? 'primary' : 'ghost'} small" data-comecar="${t.id}">${icon('play', { size: 16 })}Começar</button>
  </li>`;
}

export function itemSessao(s, { mostrarAluno = false } = {}) {
  return `<li><a class="item-sessao" href="#/sessao/${s.id}">
    <span class="sessao-data"><strong>${esc(fmtDate(diaLocal(s.inicio)).slice(0, 5))}</strong><span>${esc(quando(s.inicio))}</span></span>
    <span class="item-txt">
      <span class="item-titulo">${mostrarAluno ? `${esc(nomePessoa(s.aluno))} · ` : ''}${esc(s.nome_treino || 'Treino')}</span>
      <span class="item-meta">
        <span class="muted small">${icon('clock', { size: 14 })}${fmtDuracao(s.duracao_s)}</span>
        <span class="muted small">${plural(s.series_feitas, 'série', 'séries')}</span>
        ${Number(s.volume_kg) > 0 ? `<span class="muted small">${fmtKg(s.volume_kg)} kg</span>` : ''}
        ${s.esforco ? `<span class="selo esforco-${s.esforco}">${esc(ESFORCO[s.esforco])}</span>` : ''}
        ${s.comentario_personal ? `<span class="selo info">${icon('message', { size: 13 })}Comentário</span>` : ''}
        ${s._pendente ? '<span class="selo aviso">Aguardando internet</span>' : ''}
      </span>
    </span>
  </a></li>`;
}

export function listaSessoes(sessoes, { vazio, mostrarAluno = false, limite = 0 } = {}) {
  const lista = limite ? sessoes.slice(0, limite) : sessoes;
  if (!lista.length) return emptyState(vazio || { title: 'Nenhum treino ainda', text: 'Os treinos feitos aparecem aqui.' });
  return `<ul class="lista-sessoes">${lista.map((s) => itemSessao(s, { mostrarAluno })).join('')}</ul>`;
}

/** Tabela "evolução de carga": primeira e última carga de cada exercício. */
export function tabelaProgresso(sessoes) {
  const linhas = progressoCargas(sessoes).slice(0, 30);
  if (!linhas.length) return '<p class="muted">A evolução aparece depois dos primeiros treinos com carga anotada.</p>';
  return `<div class="table-wrap"><table class="tabela">
    <thead><tr><th scope="col">Exercício</th><th scope="col" class="num">Início</th><th scope="col" class="num">Agora</th><th scope="col" class="num">Melhor</th><th scope="col" class="num">Vezes</th></tr></thead>
    <tbody>${linhas.map((l) => {
      const dif = l.ultima - l.primeira;
      const cls = dif > 0 ? 'pos' : dif < 0 ? 'neg' : 'muted';
      return `<tr><th scope="row">${esc(l.nome)}</th>
        <td class="num">${fmtKg(l.primeira)} kg</td>
        <td class="num"><strong>${fmtKg(l.ultima)} kg</strong> ${dif ? `<span class="${cls} small">${dif > 0 ? '+' : ''}${fmtKg(dif)}</span>` : ''}</td>
        <td class="num">${fmtKg(l.max)} kg</td>
        <td class="num">${l.vezes}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

/** Começa o treino (confirma antes se já houver outro em andamento) e abre a tela de execução. */
export async function comecarTreino(id, botao) {
  const atual = sessao.ativa();
  if (atual && atual.treino_id !== id) {
    const ok = await confirmDialog({
      title: 'Já tem um treino em andamento',
      text: `“${esc(atual.nome_treino)}” começou ${esc(fmtDateTime(atual.inicio))}. Descartar esse e começar “${esc(treino(id)?.nome || '')}”?`,
      confirmLabel: 'Descartar e começar', danger: true,
    });
    if (!ok) return;
  } else if (atual) { location.hash = '#/treinar'; return; }
  const ok = await enquanto(botao, async () => { sessao.iniciar(id); return true; });
  if (ok) location.hash = '#/treinar';
}

/** Liga os botões [data-comecar] de uma tela. */
export function ligarComecar(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-comecar]');
    if (b) comecarTreino(b.dataset.comecar, b);
  });
}

