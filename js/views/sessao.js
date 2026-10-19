// Um treino já feito (#/sessao/<id>): o que foi feito em cada exercício, a anotação do aluno e o
// comentário do personal (o personal escreve aqui; o aluno lê).
import { sessao, ehStaff, ehAdmin, eu, nomePessoa, treino, atualizarSessao, excluirSessao } from '../store.js';
import { fmtDuracao, fmtKg, ESFORCO, diaLocal, resumoSessao } from '../domain.js';
import { esc, fmtDate } from '../utils.js';
import { emptyState, grupoTag, toast, enquanto, confirmDialog, limparRascunho } from '../ui.js';
import { icon } from '../icons.js';
import { quando } from './comum.js';

const hora = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function render({ sub }) {
  const s = sessao(sub);
  if (!s) return emptyState({ title: 'Treino não encontrado', text: 'Ele pode ter sido apagado.', action: '<a class="btn ghost small" href="#/inicio">Voltar ao início</a>' });
  const staff = ehStaff() && s.aluno !== eu();
  const r = resumoSessao(s.registros);
  const volta = staff ? { href: `#/aluno/${encodeURIComponent(s.aluno)}`, label: nomePessoa(s.aluno) } : { href: '#/historico', label: 'Histórico' };
  const podeApagar = (s.aluno === eu() || ehAdmin()) && !s._pendente; // pendente: ainda na fila do aparelho
  const t = treino(s.treino_id);
  return `
    <a class="voltar" href="${volta.href}">${icon('back', { size: 18 })}${esc(volta.label)}</a>
    <header class="page-head">
      <div><p class="page-kicker">${staff ? `${esc(nomePessoa(s.aluno))} · ` : ''}${esc(fmtDate(diaLocal(s.inicio)))} · ${esc(quando(s.inicio))}</p>
        <h1 class="page-title">${esc(s.nome_treino || 'Treino')}</h1>
        ${t ? `<p class="page-sub"><a class="link" href="#/treino/${t.id}">Ver a ficha</a></p>` : ''}</div>
      ${podeApagar ? `<div class="head-actions"><button type="button" class="icon-btn danger-text" data-apagar aria-label="Apagar este treino">${icon('trash')}</button></div>` : ''}
    </header>
    ${s._pendente ? '<p class="callout alert">Este treino ainda está só no aparelho. Ele é enviado sozinho quando a internet voltar.</p>' : ''}

    <dl class="mini-kpis kpis-4">
      <div><dt>Duração</dt><dd>${fmtDuracao(s.duracao_s)}</dd></div>
      <div><dt>Séries</dt><dd>${s.series_feitas}${r.total > s.series_feitas ? `<span class="muted"> de ${r.total}</span>` : ''}</dd></div>
      <div><dt>Volume</dt><dd>${Number(s.volume_kg) > 0 ? `${fmtKg(s.volume_kg)} kg` : '—'}</dd></div>
      <div><dt>Esforço</dt><dd>${s.esforco ? esc(ESFORCO[s.esforco]) : '—'}</dd></div>
    </dl>

    ${s.nota ? `<section class="block" aria-labelledby="h-nota"><div class="block-head"><h2 id="h-nota">Anotação ${staff ? 'do aluno' : 'sua'}</h2></div><p class="texto-livre">${esc(s.nota)}</p></section>` : ''}

    <section class="block" aria-labelledby="h-com">
      <div class="block-head"><h2 id="h-com">${icon('message', { size: 18 })} Comentário do personal</h2></div>
      ${ehStaff() ? `<form id="form-com" class="form-comentario" novalidate>
          <label class="sr-only" for="sc-texto">Comentário</label>
          <textarea id="sc-texto" name="texto" rows="2" maxlength="2000" placeholder="Parabéns, ajuste de carga, técnica…">${esc(s.comentario_personal)}</textarea>
          <button type="submit" class="btn primary small">Salvar comentário</button>
        </form>`
        : s.comentario_personal ? `<p class="texto-livre">${esc(s.comentario_personal)}</p>` : '<p class="muted">Seu personal ainda não comentou este treino.</p>'}
    </section>

    <section class="block" aria-labelledby="h-feito">
      <div class="block-head"><h2 id="h-feito">O que foi feito</h2><span class="muted small">${hora(s.inicio)} → ${hora(s.fim)}</span></div>
      <ol class="feito">${(s.registros || []).map((reg) => {
        const feitas = reg.series.filter((x) => x.feita);
        return `<li class="${feitas.length ? '' : 'pulado'}">
          <p class="feito-nome"><strong>${esc(reg.nome)}</strong> ${grupoTag(reg.grupo)}${feitas.length ? '' : '<span class="selo aviso">Não feito</span>'}</p>
          <ol class="feito-series">${reg.series.map((x, j) => `<li class="${x.feita ? '' : 'nao'}"><span class="muted">${j + 1}</span>
            ${x.carga != null ? `<strong>${fmtKg(x.carga)}</strong> kg` : '<span class="muted">—</span>'} × ${x.reps != null ? `<strong>${esc(x.reps)}</strong>` : '—'}
            ${x.feita ? '' : '<span class="sr-only">(não feita)</span>'}</li>`).join('')}</ol>
        </li>`;
      }).join('')}</ol>
    </section>`;
}

export function mount(root, { sub }) {
  const s = sessao(sub);
  if (!s) return;
  root.querySelector('#form-com')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = e.target.texto.value.trim();
    const ok = await enquanto(e.submitter, async () => { await atualizarSessao(s.id, { comentario_personal: texto }); return true; });
    if (ok) { limparRascunho(e.target); toast(texto ? 'Comentário salvo. O aluno já vê.' : 'Comentário apagado.'); }
  });
  root.querySelector('[data-apagar]')?.addEventListener('click', async (e) => {
    const ok = await confirmDialog({ title: 'Apagar este treino?', text: 'Ele sai do histórico e da evolução de carga. Não dá para desfazer.', confirmLabel: 'Apagar', danger: true });
    if (!ok) return;
    if (await enquanto(e.currentTarget, async () => { await excluirSessao(s.id); return true; })) {
      location.hash = ehStaff() && s.aluno !== eu() ? `#/aluno/${encodeURIComponent(s.aluno)}` : '#/historico';
      toast('Treino apagado.');
    }
  });
}
