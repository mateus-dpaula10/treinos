// Utilitários puros: dinheiro (sempre em centavos inteiros), números, datas locais e HTML seguro.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const NUM_COMPACT = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const PCT1 = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const DEC1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const DEC2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_SHORT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const DATETIME = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Formata centavos como "R$ 1.234,56". Nulo vira "—". */
export const fmtBRL = (cents) => (cents == null || !Number.isFinite(Number(cents)) ? '—' : BRL.format(Number(cents) / 100));
export const fmtNum = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : NUM.format(n));
export const fmtNumCompact = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : NUM_COMPACT.format(n));
/** Proporção (0,0123) como "1,2%". Nulo vira "—". */
export const fmtPct = (ratio) => (ratio == null || !Number.isFinite(ratio) ? '—' : PCT1.format(ratio));
export const fmtDec1 = (n) => (n == null || !Number.isFinite(n) ? '—' : DEC1.format(n));
export const fmtX = (n) => (n == null || !Number.isFinite(n) ? '—' : `${DEC2.format(n)}x`);

/** Segundos como "0:42" / "1:05". */
export function fmtDuracao(s) {
  if (s == null || !Number.isFinite(Number(s))) return '—';
  const total = Math.round(Number(s));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Converte texto digitado em centavos. Aceita "1.234,56", "1234,5", "1234.56", "R$ 10".
 * Retorna NaN se não for um número válido.
 */
export function parseMoney(input) {
  if (typeof input === 'number') return Math.round(input * 100);
  const n = parseDecimal(String(input ?? '').replace(/R\$/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Centavos para o formato de campo de texto ("1234,56"). */
export function centsToInput(cents) {
  if (cents == null || !Number.isFinite(Number(cents))) return '';
  return (Number(cents) / 100).toFixed(2).replace('.', ',');
}

/** Lê número decimal digitado em pt-BR ("0,9", "1.234,5") ou em inglês ("1234.5"). NaN se inválido. */
export function parseDecimal(input) {
  let s = String(input ?? '').replace(/[\s ]/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d*\.?\d*$/.test(s) || s === '.' || s === '-') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const pad = (n) => String(n).padStart(2, '0');

/** Data local de hoje no formato YYYY-MM-DD (sem armadilha de fuso UTC). */
export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

export const fmtDate = (iso) => (iso ? DATE.format(parseISODate(iso)) : '—');
export const fmtDateShort = (iso) => (iso ? DATE_SHORT.format(parseISODate(iso)).replace('.', '') : '—');
export const fmtDateTime = (ts) => (ts ? DATETIME.format(new Date(ts)).replace('.', '') : '—');

/** Escapa texto para interpolar em HTML. Use SEMPRE em dado digitado pelo usuário. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const sum = (arr, fn = (x) => x) => arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Pluralização simples pt-BR. */
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function normalize(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Iniciais de um nome ou e-mail ("Ana Paula" → "AP", "joao@x.com" → "JO"). */
export function iniciais(nomeOuEmail) {
  const base = String(nomeOuEmail || '').split('@')[0].trim();
  if (!base) return '?';
  const partes = base.split(/[\s._-]+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** Copia texto para a área de transferência (com plano B para navegadores sem a API). */
export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
