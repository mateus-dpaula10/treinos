// Tour guiado: destaca cada parte do app com uma explicação curta. Abre sozinho no primeiro acesso
// de cada pessoa neste aparelho e pode ser refeito em Ajustes. Navega entre as telas sozinho.
import { state, ehStaff, meusAlunos } from './store.js';
import { esc } from './utils.js';

const VERSAO = 1; // suba para mostrar o tour de novo a todos depois de uma mudança grande
const chave = () => `treinos:tour:${state.membro?.email || 'anon'}`;

export function tourVisto() {
  try { return Number(localStorage.getItem(chave())) >= VERSAO; } catch { return true; }
}
function marcarVisto() {
  try { localStorage.setItem(chave(), String(VERSAO)); } catch { /* sem armazenamento: só não lembra */ }
}

/**
 * Passos. `rota` = tela onde o passo acontece (o tour navega até lá); `alvo` = seletores em ordem de
 * preferência (o primeiro visível vale); sem alvo = cartão no centro.
 */
function passos() {
  if (ehStaff()) {
    const aluno = meusAlunos()[0];
    const ficha = aluno && state.treinos.find((t) => t.aluno === aluno.email);
    return [
      { titulo: 'Bem-vindo ao Treinos', texto: 'Você monta a ficha de cada aluno, ele treina com o celular na mão (séries, descanso e vídeo de cada exercício) e você acompanha tudo daqui. 1 minuto de tour.' },
      { rota: 'inicio', alvo: ['.kpis'], titulo: 'Resumo', texto: 'Quantos alunos você tem, quem treinou hoje e quantos precisam de atenção.' },
      { rota: 'inicio', alvo: ['#h-at'], bloco: true, titulo: 'Precisam de atenção', texto: 'Alunos sem ficha, sem treinar há uma semana ou com a ficha vencendo.' },
      { rota: 'alunos', alvo: ['[data-route="alunos"]'], titulo: 'Alunos', texto: 'Cadastre o aluno com o e-mail: o app cria o login e te dá o acesso pronto para mandar no WhatsApp.' },
      ...(aluno ? [{ rota: `aluno/${encodeURIComponent(aluno.email)}`, alvo: ['#h-fichas'], bloco: true, titulo: 'Fichas do aluno', texto: 'As fichas ativas entram em rodízio (A → B → C). Crie do zero ou a partir de um modelo, e mude a ordem nas setas.' },
        { rota: `aluno/${encodeURIComponent(aluno.email)}`, alvo: ['#h-hist'], bloco: true, titulo: 'Treinos feitos', texto: 'Cada treino concluído chega aqui na hora, com carga e repetições de cada série. Abra um para deixar um comentário.' }] : []),
      ...(ficha ? [{ rota: `treino/${ficha.id}`, alvo: ['#h-itens'], bloco: true, titulo: 'Montar a ficha', texto: 'Adicione exercícios da biblioteca e ajuste séries, repetições, carga, descanso e observação de cada um. Nada muda para o aluno até você salvar.' }] : []),
      { rota: 'modelos', alvo: ['[data-route="modelos"]'], titulo: 'Modelos', texto: 'Fichas prontas (iniciante, ABC…) para copiar para cada aluno novo.' },
      { rota: 'exercicios', alvo: ['[data-route="exercicios"]'], titulo: 'Exercícios', texto: 'A biblioteca com o vídeo de demonstração de cada exercício. Cole o link do YouTube ou do Vimeo: o vídeo toca dentro do app.' },
      { rota: 'ajustes', alvo: ['[data-route="ajustes"]'], titulo: 'Ajustes', texto: 'Tema, instalar o app, equipe de personais e este tour de novo.' },
      { titulo: 'Pronto!', texto: 'Comece cadastrando um aluno e montando a primeira ficha.' },
    ];
  }
  return [
    { titulo: 'Bem-vindo ao seu treino', texto: 'Aqui você vê a ficha que seu personal montou, marca cada série, controla o descanso e vê o vídeo de cada exercício.' },
    { rota: 'inicio', alvo: ['.hero', '#h-fichas'], titulo: 'Próximo treino', texto: 'O app segue o rodízio das suas fichas e já mostra qual é o treino de hoje. Toque em “Começar treino”.' },
    { rota: 'inicio', alvo: ['#h-fichas'], bloco: true, titulo: 'Suas fichas', texto: 'Abra uma ficha para ver os exercícios, as séries e o vídeo de cada um antes de começar.' },
    { titulo: 'Durante o treino', texto: 'Cada série tem carga e repetições (já vêm as da última vez). Toque no ✓ ao terminar a série: o descanso começa sozinho e avisa com bipe e vibração.' },
    { rota: 'historico', alvo: ['[data-route="historico"]'], titulo: 'Histórico', texto: 'Todos os treinos feitos, os comentários do personal e a evolução de carga em cada exercício.' },
    { rota: 'exercicios', alvo: ['[data-route="exercicios"]'], titulo: 'Exercícios', texto: 'Os vídeos de como fazer cada exercício, para consultar quando quiser.' },
    { rota: 'ajustes', alvo: ['[data-route="ajustes"]'], titulo: 'Ajustes', texto: 'Som e vibração do descanso, tela ligada durante o treino e instalar o app no celular.' },
    { titulo: 'Bom treino!', texto: 'Dica: instale o app na tela inicial (Ajustes) para abrir direto na academia.' },
  ];
}

let ativo = null;

const visivel = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

/** Elemento do passo: o primeiro alvo visível; em passos de bloco, a seção inteira em volta do título. */
function acharAlvo(p) {
  for (const sel of p.alvo || []) {
    let el = document.querySelector(sel);
    if (p.bloco) el = el?.closest('section') || el;
    if (visivel(el)) return el;
  }
  return null;
}

const esperarAlvo = (p) => new Promise((resolve) => {
  if (!p.alvo) { resolve(null); return; }
  const fim = Date.now() + 2000;
  const tentar = () => {
    const el = acharAlvo(p);
    if (el || Date.now() > fim) resolve(el); else setTimeout(tentar, 60);
  };
  tentar();
});

function irPara(rota) {
  if (!rota) return;
  const atual = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (atual !== rota) location.hash = `#/${rota}`;
}

function posicionar() {
  if (!ativo) return;
  const { foco, cartao, alvo } = ativo;
  const el = alvo && document.contains(alvo) ? alvo : (ativo.passo.alvo ? acharAlvo(ativo.passo) : null);
  ativo.alvo = el;
  const margem = 8;
  if (!el) {
    foco.style.cssText = 'left:50%;top:50%;width:0;height:0';
    cartao.classList.add('centro');
    cartao.style.left = ''; cartao.style.top = '';
    return;
  }
  cartao.classList.remove('centro');
  const r = el.getBoundingClientRect();
  const vh = innerHeight; const vw = innerWidth;
  const top = Math.max(4, r.top - margem); const left = Math.max(4, r.left - margem);
  const w = Math.min(vw - 8, r.width + margem * 2); const h = Math.min(vh - 8 - top, r.height + margem * 2);
  foco.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${Math.max(0, h)}px`;
  if (vw < 640) { // no celular o cartão fica preso embaixo, ou em cima quando o destaque está na metade de baixo
    cartao.style.left = ''; cartao.style.top = '';
    cartao.classList.toggle('topo', r.top + r.height / 2 > vh / 2);
    return;
  }
  const cw = cartao.offsetWidth; const ch = cartao.offsetHeight;
  const abaixo = top + h + 12; const acima = top - ch - 12;
  let y = abaixo + ch <= vh - 8 ? abaixo : acima >= 8 ? acima : Math.max(8, Math.min(vh - ch - 8, top));
  let x = Math.min(Math.max(8, left), vw - cw - 8);
  // Alvo alto (coluna do menu, quadro inteiro) sem espaço acima/abaixo: cartão ao lado.
  if (y === top && left + w + cw + 20 < vw) { x = left + w + 12; y = Math.max(8, Math.min(vh - ch - 8, top)); }
  cartao.style.left = `${x}px`; cartao.style.top = `${y}px`;
}

async function mostrar(i) {
  const lista = ativo.lista;
  ativo.i = i;
  const p = lista[i];
  ativo.passo = p;
  irPara(p.rota);
  ativo.cartao.setAttribute('aria-busy', 'true');
  const el = await esperarAlvo(p);
  if (!ativo || ativo.i !== i) return; // pulou/fechou enquanto esperava
  ativo.alvo = el;
  el?.scrollIntoView({ block: 'center', inline: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const ultimo = i === lista.length - 1;
  ativo.cartao.innerHTML = `
    <p class="tour-passo">${i + 1} de ${lista.length}</p>
    <h2 id="tour-titulo" class="tour-titulo">${esc(p.titulo)}</h2>
    <p id="tour-texto" class="tour-texto">${esc(p.texto)}</p>
    <div class="tour-acoes">
      ${ultimo ? '' : '<button type="button" class="btn link small" data-tour-pular>Pular tour</button>'}
      <span class="tour-nav">
        ${i > 0 ? '<button type="button" class="btn ghost small" data-tour-voltar>Voltar</button>' : ''}
        <button type="button" class="btn primary small" data-tour-proximo>${ultimo ? 'Concluir' : i === 0 ? 'Começar' : 'Próximo'}</button>
      </span>
    </div>`;
  ativo.cartao.removeAttribute('aria-busy');
  posicionar();
  setTimeout(posicionar, 350); // depois da rolagem suave
  ativo.cartao.querySelector('[data-tour-proximo]').focus({ preventScroll: true });
}

export function encerrarTour() {
  if (!ativo) return;
  marcarVisto();
  cancelAnimationFrame(ativo.raf);
  removeEventListener('resize', posicionar);
  document.removeEventListener('keydown', ativo.teclas, true);
  ativo.raiz.remove();
  const voltarFoco = ativo.focoAnterior;
  ativo = null;
  voltarFoco?.focus?.({ preventScroll: true });
}

export function iniciarTour() {
  if (ativo) return;
  const raiz = document.createElement('div');
  raiz.className = 'tour';
  raiz.innerHTML = `<div class="tour-foco" aria-hidden="true"></div>
    <div class="tour-cartao" role="dialog" aria-modal="true" aria-labelledby="tour-titulo" aria-describedby="tour-texto"></div>`;
  document.body.appendChild(raiz);
  const teclas = (e) => {
    if (!ativo) return;
    if (e.key === 'Escape') { e.preventDefault(); encerrarTour(); return; }
    if (e.key === 'Tab') { // foco preso no cartão
      const bts = [...ativo.cartao.querySelectorAll('button')];
      if (!bts.length) return;
      const i = bts.indexOf(document.activeElement);
      e.preventDefault();
      bts.at(e.shiftKey ? (i <= 0 ? -1 : i - 1) : (i + 1) % bts.length).focus();
    }
  };
  ativo = {
    raiz, foco: raiz.querySelector('.tour-foco'), cartao: raiz.querySelector('.tour-cartao'),
    lista: passos(), i: 0, teclas, focoAnterior: document.activeElement,
  };
  ativo.cartao.addEventListener('click', (e) => {
    if (e.target.closest('[data-tour-pular]')) encerrarTour();
    else if (e.target.closest('[data-tour-voltar]')) mostrar(ativo.i - 1);
    else if (e.target.closest('[data-tour-proximo]')) {
      if (ativo.i === ativo.lista.length - 1) encerrarTour(); else mostrar(ativo.i + 1);
    }
  });
  // Clique fora do cartão não faz nada (evita sair do tour sem querer); a tela por baixo fica bloqueada.
  document.addEventListener('keydown', teclas, true);
  addEventListener('resize', posicionar);
  // Acompanha rolagem e redesenhos da tela (o alvo pode ser trocado por um igual).
  const seguir = () => { posicionar(); if (ativo) ativo.raf = requestAnimationFrame(seguir); };
  ativo.raf = requestAnimationFrame(seguir);
  mostrar(0);
}
