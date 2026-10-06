// Acute:chronic load metrics (Gabbett 2016), from Stride (supabase/functions/_shared/gemini.ts).
import type { Activity } from './types';

export interface LoadMetrics {
  km7: number;
  km28: number;
  avgWeeklyKm28: number;
  load7: number;
  load28: number;
  acwr: number | null;
  runs7: number;
  runs28: number;
  longestRun28Km: number;
  daysSinceLastRun: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeLoadMetrics(activities: Activity[], today: string): LoadMetrics {
  const todayMs = Date.parse(`${today}T23:59:59Z`);
  const dayMs = 86_400_000;
  // Duration (minutes) stands in when there's no training load.
  const loadOf = (a: Activity) => a.training_load ?? a.duration_s / 60;

  let km7 = 0, km28 = 0, load7 = 0, load28 = 0, runs7 = 0, runs28 = 0, longest = 0;
  let lastRun: number | null = null;
  for (const a of activities) {
    const t = Date.parse(a.start_time);
    const ageDays = (todayMs - t) / dayMs;
    if (ageDays < 0 || ageDays > 28) continue;
    const km = a.distance_m / 1000;
    km28 += km;
    load28 += loadOf(a);
    runs28++;
    longest = Math.max(longest, km);
    if (ageDays <= 7) {
      km7 += km;
      load7 += loadOf(a);
      runs7++;
    }
    lastRun = lastRun === null ? t : Math.max(lastRun, t);
  }
  const chronicWeekly = load28 / 4;
  return {
    km7: round1(km7),
    km28: round1(km28),
    avgWeeklyKm28: round1(km28 / 4),
    load7: Math.round(load7),
    load28: Math.round(load28),
    acwr: chronicWeekly > 0 && runs28 >= 4 ? Math.round((load7 / chronicWeekly) * 100) / 100 : null,
    runs7,
    runs28,
    longestRun28Km: round1(longest),
    daysSinceLastRun: lastRun === null ? null : Math.floor((todayMs - lastRun) / dayMs),
  };
}
