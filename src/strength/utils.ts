// Formatting and math helpers from lift/js/utils.js, with Hebrew text.
import { LOCALE } from '../lib/dates';

export const DAY = 86_400_000;
export const WEEK = 7 * DAY;
export const KG_PER_LB = 0.45359237;

export function uid(): string {
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function deepClone<T>(o: T): T {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

export function roundTo(n: number, step = 0.01) {
  return Math.round(n / step) * step;
}

export function fmtNum(n: number | string | null | undefined): string {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, '');
}

export function fmtCompact(n: number): string {
  n = Math.round(Number(n) || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/** Epley 1RM estimate (kg in → kg out). */
export function epley1RM(weightKg: number, reps: number): number {
  if (!weightKg || !reps) return 0;
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}ש׳ ${m}ד׳`;
  if (m > 0) return s ? `${m}ד׳ ${s}ש׳` : `${m} דק׳`;
  return `${s} שנ׳`;
}

export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDate(ts: number, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(ts).toLocaleDateString(LOCALE, opts ?? { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function relDay(ts: number): string {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / DAY);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  if (diff > 1 && diff < 7) return `לפני ${diff} ימים`;
  return fmtDate(ts, { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
}

/** Sunday-based week start (Israeli week). */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || '').join('').toUpperCase() || '?';
}

/** "3 סטים" style counts with the singular for 1. */
export function count(n: number, one: string, many: string): string {
  return n === 1 ? `${one} אחד` : `${n} ${many}`;
}

export function toNum(v: number | '' | null | undefined): number {
  return Number(v) || 0;
}
