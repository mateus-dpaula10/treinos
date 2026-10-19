// Cadastro de pessoas: aluno (pelo personal ou admin) e personal (só admin). "Adicionar" cria o login com
// uma senha inicial já liberada e mostra o acesso pronto para mandar no WhatsApp.
import { state, ehAdmin, eu, personais, adicionarPessoa, salvarPessoa, definirSenha, removerPessoa } from '../store.js';
import { MODO_LOCAL } from '../api.js';
import { PAPEIS } from '../domain.js';
import { esc, copiar } from '../utils.js';
import { openDialog, sheetHeader, toast, enquanto } from '../ui.js';
import { icon } from '../icons.js';

/** Senha aleatória fácil de ditar (sem caracteres parecidos como l/1, O/0). */
function gerarSenha(tam = 10) {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(tam));
  return [...bytes].map((n) => letras[n % letras.length]).join('');
}

const campoSenha = (id, rotulo, dica) => `<label class="field" for="${id}"><span class="field-label">${rotulo}</span>
  <span class="inline"><input id="${id}" name="senha" type="text" minlength="8" autocomplete="new-password" spellcheck="false">
  <button type="button" class="btn ghost small" data-gerar="${id}">Gerar</button></span>
  <span class="field-hint">${dica}</span></label>`;

function opcoesPersonal(atual) {
  return personais().map((p) => `<option value="${esc(p.email)}" ${atual === p.email ? 'selected' : ''}>${esc(p.nome || p.email)}${p.email === eu() ? ' (você)' : ''}</option>`).join('');
}

/** Depois de criar: o acesso pronto para copiar e mandar para a pessoa. */
function mostrarAcesso(dlg, { email, senha, loginExistia, nome }) {
  const endereco = `${location.origin}${location.pathname}`;
  const oi = nome ? `Oi, ${nome.split(' ')[0]}! ` : '';
  const texto = loginExistia
    ? `${oi}Seu acesso ao app de treinos foi liberado.\nEndereço: ${endereco}\nE-mail: ${email}\n(use a senha que você já tinha)`
    : `${oi}Seu acesso ao app de treinos:\nEndereço: ${endereco}\nE-mail: ${email}\nSenha: ${senha}\nDá para instalar no celular: abra o endereço e use "Adicionar à tela inicial".`;
  dlg.innerHTML = `<div class="sheet-body">
    ${sheetHeader('Cadastro feito')}
    <p>${loginExistia ? `${esc(email)} já tinha login: foi só liberado aqui, com a senha de antes.` : 'Login criado e liberado. Mande o acesso abaixo para a pessoa:'}</p>
    <pre class="acesso">${esc(texto)}</pre>
    <div class="actions">
      <button type="button" class="btn ghost" data-close>Fechar</button>
      <button type="button" class="btn primary" data-copiar-acesso>${icon('copy', { size: 18 })}Copiar acesso</button>
    </div></div>`;
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-copiar-acesso]').addEventListener('click', async () => {
    if (await copiar(texto)) toast('Acesso copiado.', { timeout: 2000 });
  });
}

const validarEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

/** Novo aluno ou novo personal. aoCriar(email) depois de gravar. */
export function abrirNovaPessoa({ papel = 'aluno', aoCriar } = {}) {
  const aluno = papel === 'aluno';
  const dlg = openDialog(`
    <form class="sheet-body" novalidate>
      ${sheetHeader(aluno ? 'Novo aluno' : 'Novo personal')}
      <label class="field" for="np-nome"><span class="field-label">Nome</span><input id="np-nome" name="nome" maxlength="80" required autofocus autocomplete="off"></label>
      <label class="field" for="np-email"><span class="field-label">E-mail <small>(é o login)</small></span><input id="np-email" name="email" type="email" required autocomplete="off"></label>
      ${aluno ? `<div class="grid-2">
        <label class="field" for="np-obj"><span class="field-label">Objetivo</span><input id="np-obj" name="objetivo" maxlength="200" placeholder="Hipertrofia, emagrecimento…"></label>
        <label class="field" for="np-tel"><span class="field-label">WhatsApp <small>(opcional)</small></span><input id="np-tel" name="telefone" type="tel" maxlength="30" inputmode="tel"></label>
      </div>
      ${ehAdmin() ? `<label class="field" for="np-personal"><span class="field-label">Personal responsável</span><select id="np-personal" name="personal">${opcoesPersonal(eu())}</select></label>` : ''}` : `
      <label class="field" for="np-papel"><span class="field-label">Papel</span><select id="np-papel" name="papel">
        <option value="personal">Personal (monta treino para os alunos dele)</option><option value="admin">Admin (vê tudo e cadastra personais)</option></select></label>`}
      ${MODO_LOCAL ? '' : campoSenha('np-senha', 'Senha inicial', 'Mínimo 8 caracteres. A pessoa pode trocar depois em Ajustes.')}
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary">${MODO_LOCAL ? 'Cadastrar' : 'Criar acesso'}</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  dlg.querySelector('[data-gerar]')?.addEventListener('click', (e) => { f.querySelector(`#${e.currentTarget.dataset.gerar}`).value = gerarSenha(); });
  if (f.senha) f.senha.value = gerarSenha();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = f.nome.value.trim();
    const email = f.email.value.trim().toLowerCase();
    const senha = f.senha?.value.trim() || '';
    if (!nome) { toast('Digite o nome.', { tone: 'alert' }); f.nome.focus(); return; }
    if (!validarEmail(email)) { toast('Digite um e-mail válido.', { tone: 'alert' }); f.email.focus(); return; }
    if (!MODO_LOCAL && senha.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres (ou clique em Gerar).', { tone: 'alert' }); f.senha.focus(); return; }
    if (state.membros.some((m) => m.email === email)) { toast('Esse e-mail já está cadastrado.', { tone: 'alert' }); return; }
    const dados = aluno
      ? { email, nome, senha, papel: 'aluno', personal: f.personal?.value || eu(), objetivo: f.objetivo.value.trim(), telefone: f.telefone.value.trim() }
      : { email, nome, senha, papel: f.papel.value, personal: null };
    const r = await enquanto(e.submitter, () => adicionarPessoa(dados));
    if (!r) return;
    aoCriar?.(email);
    if (MODO_LOCAL) { dlg.close(); toast(`${esc(nome)} cadastrado.`); } else mostrarAcesso(dlg, { email, senha, nome, loginExistia: r.loginExistia });
  });
}

/** Editar dados, trocar senha ou remover. */
export function abrirEditarPessoa(m, { aoRemover } = {}) {
  const aluno = m.papel === 'aluno';
  const euMesmo = m.email === eu();
  const dlg = openDialog(`
    <form class="sheet-body" novalidate>
      ${sheetHeader(aluno ? 'Dados do aluno' : 'Editar pessoa')}
      <label class="field" for="ep-email"><span class="field-label">E-mail</span><input id="ep-email" value="${esc(m.email)}" readonly></label>
      <label class="field" for="ep-nome"><span class="field-label">Nome</span><input id="ep-nome" name="nome" maxlength="80" value="${esc(m.nome)}" autofocus></label>
      ${aluno ? `<div class="grid-2">
        <label class="field" for="ep-obj"><span class="field-label">Objetivo</span><input id="ep-obj" name="objetivo" maxlength="200" value="${esc(m.objetivo)}"></label>
        <label class="field" for="ep-tel"><span class="field-label">WhatsApp</span><input id="ep-tel" name="telefone" type="tel" maxlength="30" value="${esc(m.telefone)}"></label>
      </div>
      <label class="field" for="ep-notas"><span class="field-label">Restrições e anotações <small>(só personal e admin veem)</small></span>
        <textarea id="ep-notas" name="notas" rows="3" maxlength="4000" placeholder="Lesões, dores, medicação, preferências…">${esc(m.notas)}</textarea></label>
      ${ehAdmin() ? `<label class="field" for="ep-personal"><span class="field-label">Personal responsável</span><select id="ep-personal" name="personal">
        <option value="">Nenhum</option>${opcoesPersonal(m.personal)}</select></label>` : ''}`
        : (ehAdmin() && !euMesmo ? `<label class="field" for="ep-papel"><span class="field-label">Papel</span><select id="ep-papel" name="papel">
          ${['personal', 'admin'].map((p) => `<option value="${p}" ${m.papel === p ? 'selected' : ''}>${PAPEIS[p]}</option>`).join('')}</select></label>` : '')}
      ${MODO_LOCAL || euMesmo ? '' : campoSenha('ep-senha', 'Nova senha <small>(opcional)</small>', 'Preencha só para trocar a senha. Mínimo 8 caracteres.')}
      <div class="actions">
        ${euMesmo ? '' : `<button type="button" class="btn link danger-text" data-remover>Remover</button>`}
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary">Salvar</button>
      </div>
    </form>`);
  const f = dlg.querySelector('form');
  dlg.querySelector('[data-gerar]')?.addEventListener('click', (e) => { f.querySelector(`#${e.currentTarget.dataset.gerar}`).value = gerarSenha(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = f.senha?.value.trim() || '';
    if (senha && senha.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.', { tone: 'alert' }); f.senha.focus(); return; }
    const patch = { nome: f.nome.value.trim() };
    if (aluno) Object.assign(patch, { objetivo: f.objetivo.value.trim(), telefone: f.telefone.value.trim(), notas: f.notas.value.trim(), ...(f.personal ? { personal: f.personal.value || null } : {}) });
    else if (f.papel) patch.papel = f.papel.value;
    const ok = await enquanto(e.submitter, async () => {
      await salvarPessoa(m.email, patch);
      if (senha) await definirSenha(m.email, senha);
      return true;
    });
    if (ok) { dlg.close(); toast(senha ? 'Dados salvos e senha trocada.' : 'Dados salvos.'); }
  });
  dlg.querySelector('[data-remover]')?.addEventListener('click', () => {
    const corpo = dlg.querySelector('.sheet-body');
    corpo.innerHTML = `${sheetHeader(`Remover ${m.nome || m.email}?`)}
      <p>${esc(m.email)} perde o acesso na hora.${aluno ? ' As fichas e o histórico de treinos dele são apagados.' : ' Os alunos dele ficam sem personal (o admin pode passar para outro).'}</p>
      ${MODO_LOCAL ? '' : '<label class="check"><input type="checkbox" id="rm-login"><span>Apagar também o login <small>(para voltar, será preciso cadastrar de novo)</small></span></label>'}
      <div class="actions">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="button" class="btn danger" data-confirmar>Remover</button>
      </div>`;
    corpo.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    corpo.querySelector('[data-confirmar]').addEventListener('click', async (e) => {
      const apagar = corpo.querySelector('#rm-login')?.checked || false;
      const r = await enquanto(e.currentTarget, () => removerPessoa(m.email, apagar));
      if (r) { dlg.close(); toast(r.loginApagado ? 'Removido e login apagado.' : 'Removido.'); aoRemover?.(); }
    });
  });
}
