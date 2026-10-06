import { LOCALE, addDays, parseISODate, type ISODate } from './dates';

export function weekDays(date: ISODate): ISODate[] {
  const dow = parseISODate(date).getDay(); // Israeli week: Sunday = 0
  const sunday = addDays(date, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Carries the last known value forward across days with no row; null before the first row.
export function fillForward<T>(rows: Array<{ date: ISODate; value: T }>, dates: ISODate[]): Array<T | null> {
  const byDate = new Map(rows.map((r) => [r.date, r.value]));
  let last: T | null = null;
  return dates.map((d) => {
    const v = byDate.get(d);
    if (v !== undefined) last = v;
    return last;
  });
}

export interface PeriodChange {
  days: number;
  delta: number | null;
  spark: number[];
}

// Change over the last N days of a daily ascending series (nulls skipped).
export function periodChanges(values: Array<number | null>, periods: number[]): PeriodChange[] {
  const clean = values.map((v) => (v == null ? NaN : v));
  const lastIdx = (() => {
    for (let i = clean.length - 1; i >= 0; i--) if (!Number.isNaN(clean[i])) return i;
    return -1;
  })();
  return periods.map((days) => {
    if (lastIdx < 0) return { days, delta: null, spark: [] };
    const startIdx = lastIdx - days;
    const slice = clean.slice(Math.max(0, startIdx), lastIdx + 1).filter((v) => !Number.isNaN(v));
    const start = startIdx >= 0 && !Number.isNaN(clean[startIdx]) ? clean[startIdx] : null;
    return {
      days,
      delta: start != null ? clean[lastIdx] - start : null,
      spark: slice,
    };
  });
}

export type RangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
export const RANGE_DAYS: Record<RangeKey, number | null> = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, ALL: null };

export function mean(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function firstLast(values: Array<number | null>): [number | null, number | null] {
  const v = values.filter((x): x is number => x != null);
  return v.length ? [v[0], v[v.length - 1]] : [null, null];
}

export function formatRange(from: ISODate, to: ISODate): string {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const month = b.toLocaleDateString(LOCALE, { month: 'short', year: 'numeric' });
  return sameMonth
    ? `${a.getDate()} – ${b.getDate()} ${month}`
    : `${a.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function axisLabels(dates: ISODate[]): string[] {
  const n = dates.length;
  if (n <= 8) return dates.map((d) => parseISODate(d).toLocaleDateString(LOCALE, { weekday: 'short' }));
  const every = Math.ceil(n / 6);
  return dates.map((d, i) =>
    i % every === 0 ? parseISODate(d).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) : '',
  );
}
