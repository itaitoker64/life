export type ISODate = string; // YYYY-MM-DD

export const LOCALE = 'he-IL';

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDateLabel(s: ISODate): string {
  const t = today();
  if (s === t) return 'היום';
  if (s === addDays(t, -1)) return 'אתמול';
  if (s === addDays(t, 1)) return 'מחר';
  return parseISODate(s).toLocaleDateString(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortDate(s: ISODate): string {
  return parseISODate(s).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
}

export function isMonday(s: ISODate): boolean {
  return parseISODate(s).getDay() === 1;
}

export function formatLongDate(s: ISODate): string {
  return parseISODate(s).toLocaleDateString(LOCALE, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function weekdayShort(s: ISODate): string {
  return parseISODate(s).toLocaleDateString(LOCALE, { weekday: 'short' });
}

export function weekdayNarrow(s: ISODate): string {
  return ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][parseISODate(s).getDay()];
}
