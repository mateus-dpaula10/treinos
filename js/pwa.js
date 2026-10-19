// App instalável: service worker (abre na hora, avisa versão nova), botão "Instalar app" e aviso de conexão.

let pedidoInstalar = null;
const ouvintesInstalar = new Set();
const avisarInstalar = () => ouvintesInstalar.forEach((fn) => fn());

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // o app mostra o próprio botão
  pedidoInstalar = e;
  avisarInstalar();
});
addEventListener('appinstalled', () => { pedidoInstalar = null; avisarInstalar(); });

export const instalacao = {
  /** O navegador deixa instalar agora (Chrome/Edge/Android). */
  disponivel: () => Boolean(pedidoInstalar),
  /** Já está aberto como app instalado. */
  instalado: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  /** iPhone/iPad: só dá para instalar pelo menu Compartilhar do Safari. */
  ios: () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  async pedir() {
    if (!pedidoInstalar) return 'indisponivel';
    pedidoInstalar.prompt();
    const { outcome } = await pedidoInstalar.userChoice;
    pedidoInstalar = null;
    avisarInstalar();
    return outcome;
  },
  aoMudar(fn) { ouvintesInstalar.add(fn); return () => ouvintesInstalar.delete(fn); },
};

/**
 * Registra o service worker. aoAtualizar(aplicar) é chamado quando há versão nova esperando;
 * aplicar() ativa a versão nova e recarrega a página.
 */
export async function registrarSW(aoAtualizar) {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // Só recarrega quando a pessoa aceitou (no primeiro acesso o service worker assume sem recarregar).
    let aceitou = false;
    const oferecer = (w) => aoAtualizar(() => { aceitou = true; w.postMessage({ type: 'SKIP_WAITING' }); });
    if (reg.waiting && navigator.serviceWorker.controller) oferecer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) oferecer(w);
      });
    });
    let recarregando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recarregando || !aceitou) return;
      recarregando = true;
      location.reload();
    });
    // App que fica aberto o dia todo: procura versão nova a cada hora e ao voltar para a aba.
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    return reg;
  } catch (err) {
    console.warn('[treinos] service worker não registrado:', err?.message || err);
    return null;
  }
}

/** Avisa quando a conexão cai e quando volta. */
export function vigiarConexao(toast) {
  let aviso = null;
  const caiu = () => {
    aviso?.remove();
    aviso = toast('Sem internet. Dá para ver a tela, mas nada é salvo até a conexão voltar.', { tone: 'alert', timeout: 0 });
  };
  addEventListener('offline', caiu);
  addEventListener('online', () => { aviso?.remove(); aviso = null; toast('Conexão de volta.', { timeout: 2500 }); });
  if (navigator.onLine === false) caiu();
}
