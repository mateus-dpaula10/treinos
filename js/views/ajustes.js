// Ajustes: conta e tema, o aviso do descanso (som, vibração, tela ligada), instalar o app e, para o
// admin, a equipe de personais. No modo local, "entrar como" para ver o app pelos olhos de cada pessoa.
import { state, ehAdmin, ehStaff, personais, meusAlunos, pessoa } from '../store.js';
import { api, MODO_LOCAL } from '../api.js';
import { PAPEIS } from '../domain.js';
import { esc, plural } from '../utils.js';
import { toast, enquanto, confirmDialog, openDialog, sheetHeader, avatar } from '../ui.js';
import { icon } from '../icons.js';
import { aplicarTema, lerTema } from '../tema.js';
import { iniciarTour } from '../tour.js';
import { instalacao } from '../pwa.js';
import * as sessao from '../sessao.js';
import { abrirNovaPessoa, abrirEditarPessoa } from './pessoas.js';

function blocoInstalar() {
  if (instalacao.instalado()) return '<p class="muted small">Aberto como app instalado neste aparelho.</p>';
  if (instalacao.disponivel()) {
    return `<button type="button" class="btn primary small" data-instalar>${icon('download', { size: 18 })}Instalar app</button>
      <p class="field-hint">Fica com ícone na tela inicial e abre em tela cheia, como um aplicativo.</p>`;
  }
  if (instalacao.ios()) return '<p class="field-hint">Para instalar no iPhone: no Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p>';
  return '<p class="field-hint">Para instalar: no menu do navegador, procure <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p>';
}

let pararInstalar = null;

const opcao = (nome, rotulo, dica, marcado, desligado = false) => `<label class="check"><input type="checkbox" data-pref="${nome}" ${marcado ? 'checked' : ''} ${desligado ? 'disabled' : ''} data-nao-suja>
  <span>${rotulo}${dica ? ` <small>${dica}</small>` : ''}</span></label>`;

export function render() {
  const tema = lerTema();
  const p = sessao.prefs();
  const m = state.membro;
  const meuPersonal = pessoa(m.personal);
  return `
    <header class="page-head"><div><h1 class="page-title">Ajustes</h1></div></header>

    ${MODO_LOCAL ? `
      <section class="block destaque-local" aria-labelledby="h-local">
        <div class="block-head"><h2 id="h-local">Modo local</h2></div>
        <p>Os dados estão só neste navegador, com exemplos para você conhecer o app. Para usar de verdade,
          crie o projeto no Supabase, rode <code>supabase/schema.sql</code> e preencha <code>js/config.js</code> (passo a passo no README).</p>
        <label class="field" for="local-como"><span class="field-label">Ver o app como</span>
          <select id="local-como" data-nao-suja>${api.todasAsPessoas().map((x) => `<option value="${esc(x.email)}" ${x.email === m.email ? 'selected' : ''}>${esc(x.nome)} · ${PAPEIS[x.papel]}</option>`).join('')}</select>
          <span class="field-hint">Escolha um aluno para ver o app pelo lado de quem treina.</span></label>
        <div class="actions left"><button type="button" class="btn ghost small" data-restaurar>Restaurar dados de exemplo</button></div>
      </section>` : ''}

    <div class="cols">
      <section class="block" aria-labelledby="h-conta">
        <div class="block-head"><h2 id="h-conta">Sua conta</h2></div>
        <p><strong>${esc(m.nome || m.email)}</strong><br><span class="muted">${esc(m.email)} · ${PAPEIS[m.papel]}</span>
          ${meuPersonal ? `<br><span class="muted">Personal: ${esc(meuPersonal.nome || meuPersonal.email)}</span>` : ''}</p>
        <fieldset class="segmented small" data-nao-suja><legend class="field-label">Tema</legend>
          ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([v, l]) => `<label><input type="radio" name="tema" value="${v}" ${tema === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        <div class="instalar" id="instalar">${blocoInstalar()}</div>
        <div class="actions left">
          <button type="button" class="btn ghost small" data-tour>Refazer o tour</button>
          ${MODO_LOCAL ? '' : `<button type="button" class="btn ghost small" data-senha>Trocar senha</button>
          <button type="button" class="btn ghost small" data-sair>${icon('logout', { size: 18 })}Sair</button>`}</div>
      </section>

      <section class="block" aria-labelledby="h-treino">
        <div class="block-head"><h2 id="h-treino">Durante o treino</h2></div>
        <p class="muted small">Vale para este aparelho.</p>
        ${opcao('descansoAuto', 'Começar o descanso ao marcar a série', '', p.descansoAuto)}
        ${opcao('som', 'Bipe no fim do descanso', '(o celular no silencioso não toca)', p.som)}
        ${opcao('vibrar', 'Vibrar no fim do descanso', 'vibrate' in navigator ? '' : '(este aparelho não vibra pelo navegador, como o iPhone)', p.vibrar, !('vibrate' in navigator))}
        ${opcao('telaLigada', 'Manter a tela ligada durante o treino', sessao.telaLigadaSuportada() ? '' : '(este navegador não permite)', p.telaLigada, !sessao.telaLigadaSuportada())}
        <div class="actions left"><button type="button" class="btn ghost small" data-testar>${icon('volume', { size: 18 })}Testar aviso</button></div>
      </section>
    </div>

    ${ehStaff() ? `<section class="block" aria-labelledby="h-equipe">
      <div class="block-head"><h2 id="h-equipe">Equipe</h2>${ehAdmin() ? `<button type="button" class="btn ghost small" data-novo-personal>${icon('plus', { size: 18 })}Personal</button>` : ''}</div>
      <ul class="lista-simples">${personais().map((x) => {
        const n = state.membros.filter((a) => a.papel === 'aluno' && a.personal === x.email).length;
        return `<li>${avatar(x.nome || x.email)}
          <span class="lista-txt"><strong>${esc(x.nome || x.email)}</strong> <span class="muted small">${esc(x.email)} · ${PAPEIS[x.papel]}${ehAdmin() ? ` · ${plural(n, 'aluno', 'alunos')}` : ''}</span></span>
          ${ehAdmin() ? `<button type="button" class="icon-btn small" data-editar-pessoa="${esc(x.email)}" aria-label="Editar ${esc(x.nome || x.email)}">${icon('edit', { size: 18 })}</button>` : ''}
        </li>`;
      }).join('')}</ul>
      <p class="field-hint">${ehAdmin() ? 'Cada personal vê só os alunos dele. Admin vê todos e cadastra personais.' : `Você acompanha ${plural(meusAlunos().length, 'aluno', 'alunos')}. Personais novos são cadastrados pelo admin.`}</p>
    </section>` : ''}`;
}

/** Trocar a própria senha, direto (sem depender de e-mail). */
function dialogoMinhaSenha() {
  const dlg = openDialog(`
    <form class="sheet-body" novalidate>
      ${sheetHeader('Trocar minha senha')}
      <label class="field" for="ms-nova"><span class="field-label">Senha nova</span>
        <input id="ms-nova" name="nova" type="password" minlength="8" autocomplete="new-password" required autofocus></label>
      <label class="field" for="ms-conf"><span class="field-label">Repita a senha nova</span>
        <input id="ms-conf" name="conf" type="password" minlength="8" autocomplete="new-password" required></label>
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary">Trocar senha</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (f.nova.value.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.', { tone: 'alert' }); return; }
    if (f.nova.value !== f.conf.value) { toast('As duas senhas não são iguais.', { tone: 'alert' }); return; }
    const ok = await enquanto(e.submitter, async () => { await api.novaSenha(f.nova.value); return true; });
    if (ok) { dlg.close(); toast('Senha trocada. Use a nova no próximo acesso.'); }
  });
}

export function mount(root) {
  pararInstalar?.();
  pararInstalar = instalacao.aoMudar(() => {
    const el = document.getElementById('instalar');
    if (el) el.innerHTML = blocoInstalar();
  });

  root.addEventListener('change', (e) => {
    if (e.target.name === 'tema') aplicarTema(e.target.value);
    else if (e.target.dataset.pref) salvarPref(e.target);
    else if (e.target.id === 'local-como') {
      // O treino em andamento é por pessoa: fica guardado para quando voltar a ela.
      api.entrarComo(e.target.value);
      location.hash = '#/inicio';
      location.reload();
    }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if ('tour' in d) iniciarTour();
    else if ('testar' in d) sessao.testarAviso();
    else if ('instalar' in d) {
      const r = await instalacao.pedir();
      if (r === 'accepted') toast('App instalado. Procure o ícone “Treinos”.');
    } else if ('sair' in d) { await api.sair(); location.reload(); }
    else if ('senha' in d) dialogoMinhaSenha();
    else if ('novoPersonal' in d) abrirNovaPessoa({ papel: 'personal' });
    else if (d.editarPessoa) abrirEditarPessoa(pessoa(d.editarPessoa));
    else if ('restaurar' in d) {
      const ok = await confirmDialog({ title: 'Restaurar exemplos?', text: 'Tudo o que você fez no modo local é apagado e os dados de exemplo voltam.', confirmLabel: 'Restaurar', danger: true });
      if (ok) { api.restaurarExemplo(); location.hash = '#/inicio'; location.reload(); }
    }
  });
}

function salvarPref(el) {
  sessao.salvarPrefs({ [el.dataset.pref]: el.checked });
  toast('Preferência salva.', { timeout: 1500 });
}

