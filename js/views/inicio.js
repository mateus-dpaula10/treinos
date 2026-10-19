// Início. Aluno: o próximo treino do rodízio, as fichas e a frequência. Personal: quem treinou,
// quem sumiu e as fichas vencendo.
import { state, ehStaff, eu, pessoa, nomePessoa, fichasDe, sessoesDe, meusAlunos } from '../store.js';
import { proximoTreino, diasTreinados, diasDesde, diaLocal, resumoSessao } from '../domain.js';
import { esc, plural, todayISO } from '../utils.js';
import { emptyState, avatar } from '../ui.js';
import { icon } from '../icons.js';
import * as sessao from '../sessao.js';
import { cartaoFicha, textoResumo, listaSessoes, ligarComecar, quando, validadeBadge } from './comum.js';

function emAndamento() {
  const s = sessao.ativa();
  if (!s) return '';
  const r = resumoSessao(s.registros);
  return `<a class="andamento" href="#/treinar">
    <span class="andamento-icone">${icon('timer', { size: 26 })}</span>
    <span class="item-txt"><strong>Treino em andamento</strong><span>${esc(s.nome_treino)} · ${r.feitas} de ${r.total} séries</span></span>
    <span class="btn primary small">Continuar</span>
  </a>`;
}

function renderAluno() {
  const minhas = sessoesDe(eu());
  const fichas = fichasDe(eu());
  const prox = proximoTreino(fichas, minhas);
  const ultima = minhas[0];
  const parado = ultima ? diasDesde(diaLocal(ultima.inicio)) : null;
  const meuPersonal = pessoa(state.membro.personal);
  const nome = (state.membro.nome || '').split(' ')[0] || nomePessoa(eu());
  return `
    <header class="page-head">
      <div><p class="page-kicker">Olá, ${esc(nome)}</p><h1 class="page-title">Hoje</h1>
      ${meuPersonal ? `<p class="page-sub">Personal: ${esc(meuPersonal.nome || meuPersonal.email)}</p>` : ''}</div>
    </header>

    ${emAndamento()}

    ${prox && !sessao.ativa() ? `<section class="hero" aria-labelledby="h-prox">
      <p class="hero-kicker">${icon('flag', { size: 16 })}Próximo treino</p>
      <h2 id="h-prox" class="hero-titulo">${esc(prox.nome)}</h2>
      <p class="hero-meta">${textoResumo(prox.itens)}</p>
      <div class="actions left">
        <button type="button" class="btn primary grande" data-comecar="${prox.id}">${icon('play', { size: 20 })}Começar treino</button>
        <a class="btn ghost" href="#/treino/${prox.id}">Ver a ficha</a>
      </div>
    </section>` : ''}

    <section class="kpis" aria-label="Frequência">
      <div class="kpi"><span class="kpi-label">Últimos 7 dias</span><span class="kpi-valor">${plural(diasTreinados(minhas, { n: 7 }), 'treino', 'treinos')}</span></div>
      <div class="kpi"><span class="kpi-label">Últimos 30 dias</span><span class="kpi-valor">${diasTreinados(minhas, { n: 30 })}</span></div>
      <div class="kpi ${parado >= 5 ? 'kpi-alerta' : ''}"><span class="kpi-label">Último treino</span><span class="kpi-valor">${ultima ? quando(ultima.inicio) : '—'}</span></div>
      <a class="kpi" href="#/historico"><span class="kpi-label">Total</span><span class="kpi-valor">${minhas.length}</span></a>
    </section>

    <section class="block" aria-labelledby="h-fichas">
      <div class="block-head"><h2 id="h-fichas">Suas fichas</h2><span class="muted small">em rodízio</span></div>
      ${fichas.length ? `<ul class="fichas">${fichas.map((t) => cartaoFicha(t, { sessoes: minhas, destaque: t.id === prox?.id && !sessao.ativa() })).join('')}</ul>`
        : emptyState({ title: 'Nenhuma ficha ainda', text: 'Assim que seu personal montar seu treino, ele aparece aqui.' })}
    </section>

    <section class="block" aria-labelledby="h-ult">
      <div class="block-head"><h2 id="h-ult">Últimos treinos</h2><a class="link" href="#/historico">Histórico</a></div>
      ${listaSessoes(minhas, { limite: 4, vazio: { title: 'Nenhum treino feito', text: 'Comece pelo próximo treino ali em cima.' } })}
    </section>`;
}

function renderStaff() {
  const alunos = meusAlunos();
  const emails = new Set(alunos.map((a) => a.email));
  const sessoes = state.sessoes.filter((s) => emails.has(s.aluno));
  const hoje = todayISO();
  const hojeN = new Set(sessoes.filter((s) => diaLocal(s.inicio) === hoje).map((s) => s.aluno)).size;
  const semana = sessoes.filter((s) => diasDesde(diaLocal(s.inicio), hoje) < 7).length;
  const atencao = alunos.map((a) => {
    const ultima = sessoes.find((s) => s.aluno === a.email);
    const dias = ultima ? diasDesde(diaLocal(ultima.inicio), hoje) : null;
    const fichas = fichasDe(a.email);
    const vencidas = fichas.filter((t) => validadeBadge(t));
    const motivos = [];
    if (!fichas.length) motivos.push('sem ficha');
    if (dias == null && fichas.length) motivos.push('ainda não treinou');
    if (dias >= 7) motivos.push(`sem treinar há ${dias} dias`);
    if (vencidas.length) motivos.push(vencidas.length === 1 ? 'ficha vencendo' : `${vencidas.length} fichas vencendo`);
    return { a, motivos, dias };
  }).filter((x) => x.motivos.length).sort((x, y) => (y.dias ?? 999) - (x.dias ?? 999));
  const nome = (state.membro.nome || '').split(' ')[0] || nomePessoa(eu());

  return `
    <header class="page-head">
      <div><p class="page-kicker">Olá, ${esc(nome)}</p><h1 class="page-title">Seus alunos</h1></div>
      <div class="head-actions"><button type="button" class="btn primary only-desktop" data-novo-aluno>${icon('plus')}Novo aluno</button></div>
    </header>

    <section class="kpis" aria-label="Resumo">
      <a class="kpi" href="#/alunos"><span class="kpi-label">Alunos</span><span class="kpi-valor">${alunos.length}</span></a>
      <div class="kpi"><span class="kpi-label">Treinaram hoje</span><span class="kpi-valor">${hojeN}</span></div>
      <div class="kpi"><span class="kpi-label">Treinos em 7 dias</span><span class="kpi-valor">${semana}</span></div>
      <div class="kpi ${atencao.length ? 'kpi-alerta' : ''}"><span class="kpi-label">Precisam de atenção</span><span class="kpi-valor">${atencao.length}</span></div>
    </section>

    <div class="cols">
      <section class="block" aria-labelledby="h-rec">
        <div class="block-head"><h2 id="h-rec">Treinaram por último</h2></div>
        ${listaSessoes(sessoes, { limite: 8, mostrarAluno: true, vazio: { title: 'Nenhum treino ainda', text: 'Quando um aluno concluir um treino, ele aparece aqui na hora.' } })}
      </section>

      <section class="block" aria-labelledby="h-at">
        <div class="block-head"><h2 id="h-at">Precisam de atenção</h2></div>
        ${atencao.length ? `<ul class="lista-simples">${atencao.slice(0, 10).map(({ a, motivos }) => `<li>
          ${avatar(a.nome || a.email)}
          <a class="lista-txt link-forte" href="#/aluno/${encodeURIComponent(a.email)}"><strong>${esc(a.nome || a.email)}</strong>
            <span class="muted small">${esc(motivos.join(' · '))}</span></a>
        </li>`).join('')}</ul>`
          : emptyState({ title: 'Tudo em dia', text: alunos.length ? 'Todos os alunos treinaram na última semana e têm ficha válida.' : 'Cadastre o primeiro aluno para começar.', action: alunos.length ? '' : '<button type="button" class="btn primary small" data-novo-aluno>Novo aluno</button>' })}
      </section>
    </div>`;
}

export function render() {
  return ehStaff() ? renderStaff() : renderAluno();
}

export function mount(root) {
  ligarComecar(root);
}
