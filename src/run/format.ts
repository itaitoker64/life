// Display helpers from Stride (web/src/lib/format.ts), with colors for the Lift-style theme.
import type { WorkoutType } from './types';

export function formatPace(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '–';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatKm(meters: number, digits = 2): string {
  return (meters / 1000).toFixed(digits);
}

/** "1:45:00" / "25:30" → seconds. */
export function parseTime(v: string): number | null {
  const parts = v.trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export const WORKOUT_META: Record<WorkoutType, { label: string; color: string }> = {
  easy: { label: 'ריצה קלה', color: '#22c55e' },
  recovery: { label: 'התאוששות', color: '#2dd4bf' },
  long: { label: 'ריצה ארוכה', color: '#8b5cf6' },
  tempo: { label: 'טמפו', color: '#ff8a3d' },
  threshold: { label: 'סף', color: '#f43f5e' },
  intervals: { label: 'אינטרוולים', color: '#ef4444' },
  progression: { label: 'ריצה מתגברת', color: '#f59e0b' },
  rest: { label: 'מנוחה', color: '#687180' },
  race: { label: 'מרוץ', color: '#fbbf24' },
};

export const HR_ZONES = [
  { zone: 1, label: 'התאוששות', from: 0.5, to: 0.6, color: '#94a3b8' },
  { zone: 2, label: 'אירובי קל', from: 0.6, to: 0.7, color: '#22c55e' },
  { zone: 3, label: 'אירובי', from: 0.7, to: 0.8, color: '#fbbf24' },
  { zone: 4, label: 'סף', from: 0.8, to: 0.9, color: '#ff8a3d' },
  { zone: 5, label: 'מקסימלי', from: 0.9, to: 1.0, color: '#ef4444' },
] as const;

/** Karvonen (heart-rate reserve) bpm range for a zone. */
export function zoneBpm(zone: number, hrMax: number, hrRest: number): [number, number] {
  const z = HR_ZONES[zone - 1];
  const reserve = hrMax - hrRest;
  return [Math.round(hrRest + reserve * z.from), Math.round(hrRest + reserve * z.to)];
}

export const PHASE_HE: Record<string, string> = {
  base: 'בניית בסיס',
  build: 'בנייה',
  specific: 'ספציפי למרוץ',
  taper: 'טייפר',
  race_week: 'שבוע מרוץ',
  recovery: 'התאוששות',
};

export const FATIGUE_HE = {
  low: { label: 'רענן/ה', color: '#22c55e' },
  moderate: { label: 'עייפות בינונית', color: '#f59e0b' },
  high: { label: 'עייפות גבוהה', color: '#ef4444' },
} as const;

export const ZONE_INFO = [
  { key: 'recovery', label: 'התאוששות', desc: 'אחרי אימון קשה', color: '#94a3b8' },
  { key: 'easy', label: 'קל (E)', desc: 'רוב הריצות והארוכות — בונה בסיס אירובי', color: '#22c55e' },
  { key: 'marathon', label: 'מרתון (M)', desc: 'קצב המרתון החזוי שלך', color: '#4f8dff' },
  { key: 'threshold', label: 'סף (T)', desc: 'טמפו — משפר סף לקטט', color: '#f59e0b' },
  { key: 'interval', label: 'אינטרוולים (I)', desc: '3–5 דק׳ — מפתח VO2max', color: '#ff8a3d' },
  { key: 'repetition', label: 'חזרות (R)', desc: '200–400 מ׳ — מהירות וכלכליות', color: '#ef4444' },
] as const;

export const RACE_DISTANCES = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'חצי מרתון', km: 21.0975 },
  { label: 'מרתון', km: 42.195 },
];
