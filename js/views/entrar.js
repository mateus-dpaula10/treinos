// Telas fora do app: login/cadastro/recuperação, "acesso pendente" e definição de senha nova.
import { api } from '../api.js';
import { esc } from '../utils.js';
import { openDialog, sheetHeader, toast, enquanto } from '../ui.js';

const marca = `<div class="auth-brand"><img src="icons/icon.svg" alt="" width="44" height="44"><span>Treinos</span></div>`;

export function telaEntrar(root, { modo = 'entrar', aviso = '' } = {}) {
  const titulos = { entrar: 'Entrar', criar: 'Primeiro acesso', esqueci: 'Recuperar senha' };
  root.innerHTML = `
    <main class="auth" id="main" tabindex="-1">
      <div class="auth-card">
        ${marca}
        <h1 class="auth-title">${titulos[modo]}</h1>
        <p class="muted">${modo === 'criar'
          ? 'Use o e-mail que seu personal cadastrou. Você vai receber um link para confirmar.'
          : modo === 'esqueci' ? 'Enviamos um link para você criar uma senha nova.' : 'Seu treino de academia: a ficha, as séries, o descanso e o vídeo de cada exercício.'}</p>
        ${aviso ? `<p class="callout info">${aviso}</p>` : ''}
        <form id="auth-form" novalidate>
          <label class="field" for="auth-email"><span class="field-label">E-mail</span>
            <input id="auth-email" name="email" type="email" autocomplete="email" required autofocus></label>
          ${modo === 'esqueci' ? '' : `<label class="field" for="auth-senha"><span class="field-label">Senha</span>
            <input id="auth-senha" name="senha" type="password" minlength="8" required autocomplete="${modo === 'criar' ? 'new-password' : 'current-password'}">
            ${modo === 'criar' ? '<span class="field-hint">Pelo menos 8 caracteres.</span>' : ''}</label>`}
          <p class="form-erro" id="auth-erro" role="alert" hidden></p>
          <button class="btn primary block" type="submit">${modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar senha' : 'Enviar link'}</button>
        </form>
        <div class="auth-links">
          ${modo !== 'entrar' ? '<button type="button" class="btn link" data-modo="entrar">Já tenho senha</button>' : ''}
          ${modo !== 'criar' ? '<button type="button" class="btn link" data-modo="criar">Primeiro acesso</button>' : ''}
          ${modo !== 'esqueci' ? '<button type="button" class="btn link" data-modo="esqueci">Esqueci a senha</button>' : ''}
        </div>
      </div>
    </main>`;
  root.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => telaEntrar(root, { modo: b.dataset.modo })));
  const form = root.querySelector('#auth-form');
  const erro = root.querySelector('#auth-erro');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erro.hidden = true;
    const email = form.email.value.trim().toLowerCase();
    const senha = form.senha?.value || '';
    if (!/^\S+@\S+\.\S+$/.test(email)) { erro.textContent = 'Digite um e-mail válido.'; erro.hidden = false; return; }
    if (modo !== 'esqueci' && senha.length < 8) { erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; erro.hidden = false; return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      if (modo === 'entrar') await api.entrar(email, senha); // a troca de tela vem pelo evento de sessão
      else if (modo === 'criar') {
        const r = await api.cadastrar(email, senha);
        if (r.precisaConfirmar) telaEntrar(root, { modo: 'entrar', aviso: `Enviamos um link para <strong>${esc(email)}</strong>. Confirme e depois entre aqui.` });
      } else {
        await api.recuperar(email);
        telaEntrar(root, { modo: 'entrar', aviso: `Se <strong>${esc(email)}</strong> tiver conta, o link chega em instantes.` });
      }
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

export function telaPendente(root, { email, onSair, onTentar }) {
  root.innerHTML = `
    <main class="auth" id="main" tabindex="-1">
      <div class="auth-card">
        ${marca}
        <h1 class="auth-title">Acesso ainda não liberado</h1>
        <p>Você entrou como <strong>${esc(email)}</strong>, mas esse e-mail ainda não foi cadastrado.</p>
        <p class="muted">Peça para seu personal cadastrar você com este mesmo e-mail e toque em “Tentar de novo”.</p>
        <div class="actions left">
          <button type="button" class="btn primary" data-tentar>Tentar de novo</button>
          <button type="button" class="btn ghost" data-sair>Sair</button>
        </div>
      </div>
    </main>`;
  root.querySelector('[data-sair]').addEventListener('click', onSair);
  root.querySelector('[data-tentar]').addEventListener('click', (e) => enquanto(e.currentTarget, onTentar));
}

/** Depois de um link de convite/recuperação: pede a senha nova. */
export function pedirNovaSenha({ titulo = 'Crie sua senha' } = {}) {
  const dlg = openDialog(`
    <form class="sheet-body" id="nova-senha" novalidate>
      ${sheetHeader(titulo)}
      <label class="field" for="ns-senha"><span class="field-label">Senha nova</span>
        <input id="ns-senha" name="senha" type="password" minlength="8" autocomplete="new-password" required autofocus>
        <span class="field-hint">Pelo menos 8 caracteres.</span></label>
      <div class="actions"><button type="submit" class="btn primary">Salvar senha</button></div>
    </form>`);
  dlg.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = e.target.senha.value;
    if (senha.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.', { tone: 'alert' }); return; }
    const ok = await enquanto(e.submitter, async () => { await api.novaSenha(senha); return true; });
    if (ok) { dlg.close(); toast('Senha salva.'); }
  });
}
