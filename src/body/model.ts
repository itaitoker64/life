// Body-composition scans: estimates from a front and a side photo. Pure functions only, so they can
// be tested without native modules.
import type { ISODate } from '../lib/dates';

export type Sex = 'male' | 'female';
export type Confidence = 'low' | 'medium' | 'high';

export interface BodyRegionNote {
  area: string;
  note: string;
}

export interface BodyScan {
  id: string;
  date: ISODate;
  createdAt: number;
  /** Weight the estimate was made at; null when no weight was known. */
  weightKg: number | null;
  bodyFatPct: number;
  bodyFatLow: number;
  bodyFatHigh: number;
  /** 1 (very little visible muscle) … 5 (very muscular). */
  muscularity: number;
  confidence: Confidence;
  summary: string;
  regions: BodyRegionNote[];
  /** What changed since the previous scan, as seen in the photos; empty for the first scan. */
  comparison: string;
  frontUri: string;
  sideUri: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Keeps model output inside physiological bounds and the range ordered around the estimate. */
export function sanitizeEstimate(r: { bodyFatPct: number; bodyFatLow?: number | null; bodyFatHigh?: number | null; muscularity: number }) {
  const bodyFatPct = round1(clamp(r.bodyFatPct, 3, 60));
  const low = r.bodyFatLow != null && Number.isFinite(r.bodyFatLow) ? r.bodyFatLow : bodyFatPct - 3;
  const high = r.bodyFatHigh != null && Number.isFinite(r.bodyFatHigh) ? r.bodyFatHigh : bodyFatPct + 3;
  return {
    bodyFatPct,
    bodyFatLow: round1(clamp(Math.min(low, bodyFatPct), 2, bodyFatPct)),
    bodyFatHigh: round1(clamp(Math.max(high, bodyFatPct), bodyFatPct, 65)),
    muscularity: Math.round(clamp(r.muscularity, 1, 5)),
  };
}

// Skeletal muscle is roughly half of lean mass, a little more in visibly muscular people. Used only
// to turn the visual muscularity rating into kilograms; it is a rough estimate.
const MUSCLE_SHARE_OF_LEAN = [0.49, 0.51, 0.53, 0.55, 0.57];

export function composition(scan: Pick<BodyScan, 'weightKg' | 'bodyFatPct' | 'muscularity'>) {
  if (scan.weightKg == null || scan.weightKg <= 0) return null;
  const fatKg = (scan.weightKg * scan.bodyFatPct) / 100;
  const leanKg = scan.weightKg - fatKg;
  const muscleKg = leanKg * MUSCLE_SHARE_OF_LEAN[clamp(Math.round(scan.muscularity), 1, 5) - 1];
  return { fatKg: round1(fatKg), leanKg: round1(leanKg), muscleKg: round1(muscleKg) };
}

export interface ScanDelta {
  days: number;
  bodyFatPct: number;
  weightKg: number | null;
  fatKg: number | null;
  leanKg: number | null;
  muscleKg: number | null;
}

export function compareScans(from: BodyScan, to: BodyScan): ScanDelta {
  const a = composition(from);
  const b = composition(to);
  const d = (x: number | null | undefined, y: number | null | undefined) => (x == null || y == null ? null : round1(y - x));
  const days = Math.round((Date.parse(to.date) - Date.parse(from.date)) / 86400000);
  return {
    days,
    bodyFatPct: round1(to.bodyFatPct - from.bodyFatPct),
    weightKg: d(from.weightKg, to.weightKg),
    fatKg: d(a?.fatKg, b?.fatKg),
    leanKg: d(a?.leanKg, b?.leanKg),
    muscleKg: d(a?.muscleKg, b?.muscleKg),
  };
}

// American Council on Exercise body-fat categories.
const CATEGORIES: Record<Sex, Array<[number, string]>> = {
  male: [[6, 'שומן חיוני'], [14, 'אתלטי'], [18, 'כושר'], [25, 'ממוצע'], [Infinity, 'גבוה']],
  female: [[14, 'שומן חיוני'], [21, 'אתלטי'], [25, 'כושר'], [32, 'ממוצע'], [Infinity, 'גבוה']],
};

export function bodyFatCategory(pct: number, sex: Sex): string {
  return CATEGORIES[sex].find(([limit]) => pct < limit)![1];
}

export const MUSCULARITY_LABEL = ['', 'מעט מסת שריר נראית', 'מתחת לממוצע', 'ממוצע', 'מעל הממוצע', 'שרירי מאוד'];

/** Newest first. */
export function sortScans(scans: BodyScan[]): BodyScan[] {
  return [...scans].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}
