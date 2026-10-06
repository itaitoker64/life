import { allExpenditure } from '../db/profile';
import { allWeights } from '../db/weight';
import { addDays, today, type ISODate } from './dates';
import { dateRange, fillForward } from './series';
import { KCAL_PER_KG, computeTrend } from './tdee';

export interface ExpenditureSeries {
  dates: ISODate[];
  tdee: Array<number | null>;
  lo: Array<number | null>;
  hi: Array<number | null>;
  loggedDays: number;
}

// Uncertainty band narrows as more fully logged days feed the estimate.
function flux(loggedDays: number): number {
  return Math.max(40, 180 - loggedDays * 6);
}

export async function expenditureSeries(days: number | null, fallbackTdee: number): Promise<ExpenditureSeries> {
  const rows = await allExpenditure();
  const t = today();
  const first = rows.length ? rows[0].date : t;
  const from = days ? addDays(t, -(days - 1)) : first;
  const dates = dateRange(from < first && !days ? first : from, t);
  const seeded = rows.length ? rows : [{ date: t, tdee: fallbackTdee, raw_estimate: null, logged_days: 0 }];
  const tdee = fillForward(
    seeded.map((r) => ({ date: r.date, value: r.tdee })),
    dates,
  );
  const logged = fillForward(
    seeded.map((r) => ({ date: r.date, value: r.logged_days })),
    dates,
  );
  const lo = tdee.map((v, i) => (v == null ? null : v - flux(logged[i] ?? 0)));
  const hi = tdee.map((v, i) => (v == null ? null : v + flux(logged[i] ?? 0)));
  return { dates, tdee, lo, hi, loggedDays: seeded[seeded.length - 1].logged_days };
}

export interface WeightSeries {
  dates: ISODate[];
  raw: Array<number | null>;
  trend: Array<number | null>;
  all: Array<number | null>; // full trend history, daily, ascending
}

export async function weightSeries(days: number | null): Promise<WeightSeries> {
  const weights = await allWeights();
  const trend = computeTrend(weights.map((w) => ({ date: w.date, kg: w.weight_kg })));
  const t = today();
  if (!trend.length) return { dates: [], raw: [], trend: [], all: [] };
  const first = trend[0].date;
  const from = days ? addDays(t, -(days - 1)) : first;
  const dates = dateRange(from < first ? first : from, t);
  const byDate = new Map(trend.map((p) => [p.date, p]));
  let lastTrend: number | null = null;
  const trendVals = dates.map((d) => {
    const p = byDate.get(d);
    if (p) lastTrend = p.trend;
    return lastTrend;
  });
  const rawVals = dates.map((d) => byDate.get(d)?.kg ?? null);
  return { dates, raw: rawVals, trend: trendVals, all: trend.map((p) => p.trend) };
}

export interface WeightInsights {
  currentKg: number | null;
  weeklyChangeKg: number | null;
  energyPerDay: number | null;
  projection30Kg: number | null;
}

// Rate over the past three weeks of trend weight, as MacroFactor reports it.
export function weightInsights(allTrend: Array<number | null>): WeightInsights {
  const v = allTrend.filter((x): x is number => x != null);
  if (!v.length) return { currentKg: null, weeklyChangeKg: null, energyPerDay: null, projection30Kg: null };
  const current = v[v.length - 1];
  const back = Math.min(21, v.length - 1);
  if (back < 3) return { currentKg: current, weeklyChangeKg: null, energyPerDay: null, projection30Kg: null };
  const weekly = ((current - v[v.length - 1 - back]) / back) * 7;
  return {
    currentKg: current,
    weeklyChangeKg: weekly,
    energyPerDay: (weekly * KCAL_PER_KG) / 7,
    projection30Kg: current + (weekly * 30) / 7,
  };
}
