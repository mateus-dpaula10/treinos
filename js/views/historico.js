// Histórico do aluno: frequência, todos os treinos feitos e a evolução de carga por exercício.
import { eu, sessoesDe } from '../store.js';
import { diasTreinados, diasDesde, diaLocal, fmtDuracao, fmtKg } from '../domain.js';
import { plural, todayISO, esc } from '../utils.js';
import { toast } from '../ui.js';
import { listaSessoes, tabelaProgresso } from './comum.js';
import * as sessao from '../sessao.js';

export function render() {
  const minhas = sessoesDe(eu());
  const mes = minhas.filter((s) => diasDesde(diaLocal(s.inicio), todayISO()) < 30);
  const volumeMes = mes.reduce((a, s) => a + (Number(s.volume_kg) || 0), 0);
  const media = mes.length ? mes.reduce((a, s) => a + s.duracao_s, 0) / mes.length : null;
  const fila = sessao.pendentes().length;
  return `
    <header class="page-head"><div><h1 class="page-title">Histórico</h1><p class="page-sub">${plural(minhas.length, 'treino feito', 'treinos feitos')}</p></div></header>
    ${fila ? `<p class="callout alert">${plural(fila, 'treino está', 'treinos estão')} esperando internet para ir ao personal. <button type="button" class="btn link small" data-reenviar>Tentar agora</button></p>` : ''}
    <section class="kpis" aria-label="Últimos 30 dias">
      <div class="kpi"><span class="kpi-label">Treinos em 30 dias</span><span class="kpi-valor">${diasTreinados(minhas, { n: 30 })}</span></div>
      <div class="kpi"><span class="kpi-label">Por semana</span><span class="kpi-valor">${(diasTreinados(minhas, { n: 28 }) / 4).toFixed(1).replace('.', ',')}</span></div>
      <div class="kpi"><span class="kpi-label">Tempo médio</span><span class="kpi-valor">${media == null ? '—' : fmtDuracao(media)}</span></div>
      <div class="kpi"><span class="kpi-label">Volume em 30 dias</span><span class="kpi-valor">${volumeMes ? `${fmtKg(Math.round(volumeMes))} kg` : '—'}</span></div>
    </section>
    <div class="cols">
      <section class="block" aria-labelledby="h-treinos">
        <div class="block-head"><h2 id="h-treinos">Treinos</h2></div>
        ${listaSessoes(minhas, { vazio: { title: 'Nenhum treino ainda', text: 'Quando você concluir um treino, ele aparece aqui.' } })}
      </section>
      <section class="block" aria-labelledby="h-evo">
        <div class="block-head"><h2 id="h-evo">Evolução de carga</h2></div>
        ${tabelaProgresso(minhas)}
      </section>
    </div>`;
}

export function mount(root, ctx) {
  root.querySelector('[data-reenviar]')?.addEventListener('click', async () => {
    const r = await sessao.enviarPendentes();
    ctx.rerender();
    if (r.falhas && r.erro) toast(esc(r.erro.message), { tone: 'alert' });
    else if (r.enviadas) toast('Treinos enviados.');
  });
}
