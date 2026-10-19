// Alunos do personal (admin: todos, com filtro por personal): última vez que treinou, fichas e frequência.
import { ehAdmin, meusAlunos, fichasDe, sessoesDe, nomePessoa, personais } from '../store.js';
import { diasTreinados } from '../domain.js';
import { esc, normalize, plural } from '../utils.js';
import { emptyState, avatar } from '../ui.js';
import { icon } from '../icons.js';
import { quando } from './comum.js';
import { abrirNovaPessoa } from './pessoas.js';

const filtro = { busca: '', personal: '' };

export function abrirNovoAluno() {
  abrirNovaPessoa({ papel: 'aluno', aoCriar: (email) => { location.hash = `#/aluno/${encodeURIComponent(email)}`; } });
}

function linha(a) {
  const ss = sessoesDe(a.email);
  const fichas = fichasDe(a.email);
  const ultima = ss[0];
  const parado = !ultima || (Date.now() - Date.parse(ultima.inicio)) / 86400000 >= 7;
  return `<li data-busca="${esc(normalize(`${a.nome} ${a.email} ${a.objetivo}`))}" data-personal="${esc(a.personal || '')}">
    <a class="item-aluno" href="#/aluno/${encodeURIComponent(a.email)}">
      ${avatar(a.nome || a.email)}
      <span class="item-txt"><strong>${esc(a.nome || a.email)}</strong>
        <span class="item-meta">
          ${a.objetivo ? `<span class="muted small">${esc(a.objetivo)}</span>` : ''}
          ${ehAdmin() && a.personal ? `<span class="muted small">· ${esc(nomePessoa(a.personal))}</span>` : ''}
        </span></span>
      <span class="aluno-status">
        <span class="${parado ? 'selo aviso' : 'selo bom'}">${ultima ? `Treinou ${quando(ultima.inicio)}` : 'Nunca treinou'}</span>
        <span class="muted small">${plural(fichas.length, 'ficha', 'fichas')} · ${diasTreinados(ss, { n: 30 })} em 30 dias</span>
      </span>
    </a></li>`;
}

export function render() {
  const alunos = meusAlunos();
  return `
    <header class="page-head">
      <div><h1 class="page-title">Alunos</h1><p class="page-sub">${plural(alunos.length, 'aluno', 'alunos')}</p></div>
      <div class="head-actions"><button type="button" class="btn primary only-desktop" data-novo-aluno>${icon('plus')}Novo aluno</button></div>
    </header>
    ${alunos.length ? `
      <div class="filtros" role="search">
        <label class="busca">${icon('search', { size: 18 })}<span class="sr-only">Buscar aluno</span>
          <input type="search" id="al-busca" placeholder="Buscar por nome, e-mail ou objetivo…" value="${esc(filtro.busca)}" data-nao-suja></label>
        ${ehAdmin() ? `<label><span class="sr-only">Personal</span><select class="compact" id="al-personal" data-nao-suja><option value="">Todos os personais</option>
          ${personais().map((p) => `<option value="${esc(p.email)}" ${filtro.personal === p.email ? 'selected' : ''}>${esc(p.nome || p.email)}</option>`).join('')}</select></label>` : ''}
      </div>
      <ul class="lista-alunos" id="al-lista">${alunos.map(linha).join('')}</ul>
      <p class="muted" id="al-vazio" hidden>Nenhum aluno com esse filtro.</p>`
      : emptyState({ title: 'Nenhum aluno ainda', text: 'Cadastre o aluno com o e-mail dele: o app cria o login e você manda o acesso pelo WhatsApp.', action: '<button type="button" class="btn primary" data-novo-aluno>Cadastrar aluno</button>' })}`;
}

export function mount(root) {
  const busca = root.querySelector('#al-busca');
  if (!busca) return;
  const sel = root.querySelector('#al-personal');
  const aplicar = () => {
    filtro.busca = busca.value;
    filtro.personal = sel?.value || '';
    const q = normalize(filtro.busca);
    let n = 0;
    root.querySelectorAll('#al-lista > li').forEach((li) => {
      const ok = (!q || li.dataset.busca.includes(q)) && (!filtro.personal || li.dataset.personal === filtro.personal);
      li.hidden = !ok;
      if (ok) n++;
    });
    root.querySelector('#al-vazio').hidden = n > 0;
  };
  busca.addEventListener('input', aplicar);
  sel?.addEventListener('change', aplicar);
  if (filtro.busca || filtro.personal) aplicar();
}
