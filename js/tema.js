// Tema claro/escuro: 'auto' segue o sistema; 'light'/'dark' forçam. Guardado em localStorage (por aparelho).
const CHAVE = 'treinos:theme';

export function lerTema() {
  try { return localStorage.getItem(CHAVE) || 'auto'; } catch { return 'auto'; }
}

export function aplicarTema(tema = 'auto') {
  const root = document.documentElement;
  if (tema === 'light' || tema === 'dark') root.setAttribute('data-theme', tema);
  else root.removeAttribute('data-theme');
  try { localStorage.setItem(CHAVE, tema); } catch { /* sem armazenamento: só não lembra */ }
  const escuro = tema === 'dark' || (tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', escuro ? '#121314' : '#c2410c'));
}
