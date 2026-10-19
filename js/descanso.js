// Barra do descanso entre séries: fica presa embaixo da tela em qualquer rota enquanto o descanso corre
// (o aluno pode abrir o vídeo do próximo exercício sem perder a contagem). Quem conta é o relógio
// (sessao.tiqueDescanso), então a barra só desenha o que falta.
import { onChange } from './store.js';
import { proximaSerie, fmtCronometro } from './domain.js';
import { esc } from './utils.js';
import { icon } from './icons.js';
import * as sessao from './sessao.js';

let el = null;
let tique = null;
let fimVisto = 0;

function proximaTxt() {
  const s = sessao.ativa();
  const p = s && proximaSerie(s.registros);
  if (!p) return '';
  const r = s.registros[p.ex];
  return `Próxima: ${esc(r.nome)} · série ${p.serie + 1} de ${r.series.length}`;
}

/** Contador pequeno dentro do diálogo do vídeo (o diálogo fica por cima da barra). */
function desenharMini(t) {
  document.querySelectorAll('[data-descanso-mini]').forEach((m) => {
    m.hidden = !t;
    if (t) m.textContent = t.acabou ? 'Descanso acabou: hora da próxima série!' : `Descanso: ${fmtCronometro(t.falta)}`;
    m.classList.toggle('acabou', Boolean(t?.acabou));
  });
}

function desenhar() {
  const t = sessao.tiqueDescanso();
  desenharMini(t);
  if (!t) { parar(); return; }
  el.hidden = false;
  document.body.classList.add('com-descanso');
  if (t.acabou) {
    if (!fimVisto) fimVisto = Date.now();
    el.classList.add('acabou');
    el.querySelector('.descanso-rotulo').textContent = 'Descanso acabou';
    el.querySelector('.descanso-tempo').textContent = 'Bora!';
    el.querySelector('.descanso-barra').style.width = '100%';
    // Some sozinho depois de alguns segundos (o aviso já tocou).
    if (Date.now() - fimVisto > 8000) sessao.pularDescanso();
    return;
  }
  fimVisto = 0;
  el.classList.remove('acabou');
  el.querySelector('.descanso-rotulo').textContent = 'Descanso';
  el.querySelector('.descanso-tempo').textContent = fmtCronometro(t.falta);
  el.querySelector('.descanso-barra').style.width = `${Math.min(100, Math.round(((t.total - t.falta) / Math.max(1, t.total)) * 100))}%`;
}

function parar() {
  clearInterval(tique);
  tique = null;
  fimVisto = 0;
  if (el) el.hidden = true;
  document.body.classList.remove('com-descanso');
}

function atualizar() {
  const s = sessao.ativa();
  if (!s?.descanso) { parar(); desenharMini(null); return; }
  el.querySelector('.descanso-prox').innerHTML = proximaTxt();
  desenhar();
  if (!tique) tique = setInterval(desenhar, 250);
}

export function iniciarBarraDescanso() {
  el = document.getElementById('descanso');
  el.innerHTML = `
    <div class="descanso-barra-fundo" aria-hidden="true"><span class="descanso-barra"></span></div>
    <div class="descanso-corpo">
      <div class="descanso-txt" role="timer" aria-live="off">
        <span class="descanso-rotulo">Descanso</span>
        <span class="descanso-tempo">0:00</span>
        <span class="descanso-prox"></span>
      </div>
      <div class="descanso-botoes">
        <button type="button" class="icon-btn" data-ajustar="-15" aria-label="Menos 15 segundos">−15</button>
        <button type="button" class="icon-btn" data-ajustar="15" aria-label="Mais 15 segundos">+15</button>
        <button type="button" class="btn small descanso-pular" data-pular>${icon('skip', { size: 16 })}Pular</button>
      </div>
    </div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ajustar) sessao.ajustarDescanso(Number(b.dataset.ajustar));
    else if ('pular' in b.dataset) sessao.pularDescanso();
  });
  onChange((motivo) => { if (motivo === 'sessao' || motivo === 'carga') atualizar(); });
  // Voltando para o app (tela estava apagada): mostra na hora quanto falta.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') atualizar(); });
  atualizar();
}
