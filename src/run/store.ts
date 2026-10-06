import { plannedSessions } from '../planning/model';
import { usePlanning } from '../planning/store';
import { addDays } from '../lib/dates';
// Running state: what Stride kept in Supabase now lives on the phone (docs table), and the work
// Stride's edge functions did — pulling runs from intervals.icu and recalibrating the plan —
// runs here.
import { create } from 'zustand';
import { deleteDoc, loadCollection, loadDoc, saveDoc, saveDocs } from '../db/docs';
import { toISODate } from '../lib/dates';
import { generateJson } from '../lib/gemini';
import { getApiKey, getIntervalsCreds } from '../lib/secrets';
import { z } from 'zod';
import { computeLoadMetrics } from './load';
import { assess, buildPlan } from './planner';
import { estimateVdot, marathonShape, predictRaceTime, prescribeWeek, trainingPaces, vdotFromPerformance } from './science';
import {
  DEFAULT_RUN_PROFILE,
  type Activity,
  type CoachAssessment,
  type CoachingPlan,
  type PlanStatus,
  type Race,
  type RunProfile,
} from './types';

const C = {
  activities: 'run_activities',
  plans: 'run_plans',
  assessments: 'run_assessments',
  races: 'run_races',
  meta: 'run_meta',
} as const;

export interface RunState {
  profile: RunProfile;
  activities: Activity[]; // newest first
  plans: CoachingPlan[];
  assessments: CoachAssessment[]; // newest first
  races: Race[];
}

export const R: RunState = { profile: { ...DEFAULT_RUN_PROFILE }, activities: [], plans: [], assessments: [], races: [] };

export const useRun = create<{ version: number; ready: boolean; syncing: boolean; recalibrating: boolean }>(() => ({
  version: 0,
  ready: false,
  syncing: false,
  recalibrating: false,
}));

function emit() {
  useRun.setState((s) => ({ version: s.version + 1 }));
}

export function useRunVersion() {
  return useRun((s) => s.version);
}

const fail = (e: unknown) => console.error('run persist failed', e);
const sortActs = () => R.activities.sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));

export async function initRun() {
  const [profile, activities, plans, assessments, races] = await Promise.all([
    loadDoc<RunProfile>(C.meta, 'profile'),
    loadCollection<Activity>(C.activities),
    loadCollection<CoachingPlan>(C.plans),
    loadCollection<CoachAssessment>(C.assessments),
    loadCollection<Race>(C.races),
  ]);
  R.profile = { ...DEFAULT_RUN_PROFILE, ...(profile ?? {}) };
  R.activities = activities;
  sortActs();
  R.plans = plans.sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  R.assessments = assessments.sort((a, b) => b.assessed_at.localeCompare(a.assessed_at));
  R.races = races.sort((a, b) => a.race_date.localeCompare(b.race_date));
  useRun.setState((s) => ({ ready: true, version: s.version + 1 }));
}

export function updateRunProfile(patch: Partial<RunProfile>) {
  Object.assign(R.profile, patch);
  saveDoc(C.meta, 'profile', R.profile).catch(fail);
  emit();
}

// ---------------- queries ----------------

export function activitiesSince(days: number): Activity[] {
  const since = Date.now() - days * 86_400_000;
  return R.activities.filter((a) => Date.parse(a.start_time) >= since);
}

export function plansBetween(from: string, to: string): CoachingPlan[] {
  const result: CoachingPlan[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) { const p = planFor(date); if (p) result.push(p); }
  return result;
}

export function planFor(date: string): CoachingPlan | null {
  const original = R.plans.find(p => p.plan_date === date);
  const sessions = plannedSessions(usePlanning.getState().data, R.plans, date, date);
  const session = sessions.find(s => !!s.coachDate);
  if (session) {
    const source = R.plans.find(p => p.plan_date === session.coachDate);
    if (source && session.adjustment?.mode === 'reduce') {
      const factor = session.adjustment.factor ?? 0.7;
      const easy = latestAssessment()?.training_paces?.easy;
      return { ...source, plan_date: date, workout_type: 'easy', title: 'ריצה קלה · עומס מופחת',
        duration_min: source.duration_min === null ? null : Math.max(1, Math.round(source.duration_min * factor)),
        distance_km: source.distance_km === null ? null : Math.round(source.distance_km * factor * 10) / 10,
        target_pace_fast_sec_km: easy?.fast ?? null, target_pace_slow_sec_km: easy?.slow ?? null, hr_zone: 2,
        description: 'ריצה בקצב שמאפשר שיחה, ללא אינטרוולים או האצות.', adaptation_note: session.adjustment.reason };
    }
    if (source) return { ...source, plan_date: date, status: session.status ?? source.status, adaptation_note: session.adjustment?.reason ?? source.adaptation_note };
  }
  if (original && original.workout_type !== 'rest' && original.status === 'planned') return { ...original, workout_type: 'rest', title: 'יום ללא ריצה מתוכננת', duration_min: 0, distance_km: 0, description: 'השיבוץ עודכן ביומן האימונים.', adaptation_note: 'ראו את התוכנית המעודכנת ביומן.' };
  return original ?? null;
}

export function latestAssessment(): CoachAssessment | null {
  return R.assessments[0] ?? null;
}

export function upcomingRaces(): Race[] {
  const t = toISODate(new Date());
  return R.races.filter((r) => r.race_date >= t);
}

export function setPlanStatus(plan: CoachingPlan, status: PlanStatus) {
  const baseline = R.plans.find(p => p.id === plan.id);
  if (!baseline) return;
  baseline.status = status;
  plan.status = status;
  saveDoc(C.plans, baseline.id, baseline).catch(fail);
  emit();
}

export function addRace(race: Omit<Race, 'id'>) {
  const r: Race = { ...race, id: `race_${Date.now().toString(36)}` };
  R.races.push(r);
  R.races.sort((a, b) => a.race_date.localeCompare(b.race_date));
  saveDoc(C.races, r.id, r).catch(fail);
  emit();
}

export function deleteRace(id: string) {
  R.races = R.races.filter((r) => r.id !== id);
  deleteDoc(C.races, id).catch(fail);
  emit();
}

// ---------------- intervals.icu sync ----------------

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun', 'TreadmillRun']);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pace = (mps: number | null) => (mps && mps > 0 ? Math.round((1000 / mps) * 10) / 10 : null);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function mapActivity(a: any): Activity {
  const distance = num(a.distance) ?? num(a.icu_distance) ?? 0;
  const moving = num(a.moving_time) ?? num(a.elapsed_time) ?? 0;
  const speed = num(a.average_speed) ?? (moving > 0 ? distance / moving : null);
  const gapSpeed = num(a.gap);
  return {
    id: `icu_${a.id}`,
    source: 'intervals',
    start_time: a.start_date ?? a.start_date_local,
    name: a.name ?? null,
    distance_m: Math.round(distance * 10) / 10,
    duration_s: Math.round(moving),
    avg_pace_sec_per_km: pace(speed),
    gap_sec_per_km: gapSpeed && gapSpeed > 0.5 && gapSpeed < 12 ? pace(gapSpeed) : pace(speed),
    avg_hr: num(a.average_heartrate) ?? num(a.icu_average_hr),
    max_hr: num(a.max_heartrate) ?? num(a.icu_max_hr),
    elevation_gain_m: num(a.total_elevation_gain) ?? num(a.icu_elevation_gain),
    avg_cadence_spm: num(a.average_cadence) ? Math.round(a.average_cadence) : null,
    training_load: num(a.icu_training_load),
  };
}

function b64(s: string): string {
  // btoa exists in Hermes; keep a fallback for safety.
  if (typeof btoa === 'function') return btoa(s);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < s.length; i += 3) {
    const n = (s.charCodeAt(i) << 16) | ((s.charCodeAt(i + 1) || 0) << 8) | (s.charCodeAt(i + 2) || 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + (i + 1 < s.length ? chars[(n >> 6) & 63] : '=') + (i + 2 < s.length ? chars[n & 63] : '=');
  }
  return out;
}

export async function hasIntervals(): Promise<boolean> {
  return !!(await getIntervalsCreds());
}

/** Pulls runs from intervals.icu. First sync goes back 180 days, later ones overlap 3 days. */
export async function syncIntervals(opts: { fullHistory?: boolean } = {}): Promise<{ upserted: number }> {
  const creds = await getIntervalsCreds();
  if (!creds) throw new Error('intervals.icu לא מחובר — הוסיפו מפתח בהגדרות');
  useRun.setState({ syncing: true });
  try {
    const last = R.profile.last_sync_at ? Date.parse(R.profile.last_sync_at) : null;
    const since = !last || opts.fullHistory ? Date.now() - 180 * 86_400_000 : last - 3 * 86_400_000;
    const url =
      `https://intervals.icu/api/v1/athlete/${encodeURIComponent(creds.athleteId || '0')}/activities` +
      `?oldest=${day(since)}&newest=${day(Date.now() + 86_400_000)}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${b64(`API_KEY:${creds.apiKey}`)}` } });
    if (res.status === 401 || res.status === 403) throw new Error('intervals.icu דחה את המפתח — בדקו את ה-API key ואת מזהה הספורטאי');
    if (!res.ok) throw new Error(`intervals.icu החזיר שגיאה ${res.status}`);
    const all = (await res.json()) as any[];
    // Runs imported into intervals.icu from Strava come back without type/distance (Strava terms).
    const runs = all.filter((a) => RUN_TYPES.has(a.type) && (num(a.distance) ?? 0) > 0).map(mapActivity);
    const byId = new Map(R.activities.map((a) => [a.id, a]));
    for (const r of runs) byId.set(r.id, r);
    R.activities = [...byId.values()];
    sortActs();
    await saveDocs(C.activities, runs);
    updateRunProfile({ last_sync_at: new Date().toISOString(), last_sync_status: `${runs.length} ריצות`, sync_error: null });
    markCompletedRuns();
    return { upserted: runs.length };
  } catch (e) {
    updateRunProfile({ sync_error: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    useRun.setState({ syncing: false });
  }
}

/** A planned run with a matching activity that day counts as completed. */
function markCompletedRuns() {
  const changed: CoachingPlan[] = [];
  for (const p of R.plans) {
    if (p.status !== 'planned' || p.workout_type === 'rest') continue;
    if (R.activities.some((a) => toISODate(new Date(a.start_time)) === p.plan_date && a.distance_m >= 1500)) {
      p.status = 'completed';
      changed.push(p);
    }
  }
  if (changed.length) saveDocs(C.plans, changed).catch(fail);
  emit();
}

/** Sync if the last one is older than `maxAgeMin` (used on app open). */
export async function syncIfStale(maxAgeMin = 30) {
  try {
    if (!(await hasIntervals())) return;
    const last = R.profile.last_sync_at ? Date.parse(R.profile.last_sync_at) : 0;
    if (Date.now() - last < maxAgeMin * 60_000) return;
    await syncIntervals();
  } catch (e) {
    console.warn('run sync failed', e);
  }
}

// ---------------- plan recalibration (was Stride's recalibrate-plan edge function) ----------------

const NoteSchema = z.object({ summary: z.string().describe('Hebrew, 2-3 short sentences') });

/** Builds the next 7 days from the science + planner rules; Gemini only rephrases the note. */
export async function recalibratePlan(): Promise<CoachAssessment> {
  useRun.setState({ recalibrating: true });
  try {
    const today = toISODate(new Date());
    const fitnessSince = Date.parse(today) - 42 * 86_400_000;
    const weekEnd = toISODate(new Date(Date.parse(today) + 6 * 86_400_000));
    const activities = R.activities.filter((a) => Date.parse(a.start_time) >= fitnessSince).slice().reverse();
    const loadMetrics = computeLoadMetrics(activities, today);
    const { hr_max: hrMax, hr_rest: hrRest } = R.profile;
    const races = upcomingRaces();
    const prevPlan = plansBetween(today, weekEnd);
    const previousVdot = R.assessments.find((a) => a.vdot != null && a.vdot_source !== 'default')?.vdot ?? null;

    const goal = races.find((r) => r.priority === 'A' && r.target_time_s) ?? races.find((r) => r.target_time_s);
    const fallbackVdot = goal ? vdotFromPerformance(goal.distance_km * 1000, goal.target_time_s!) - 2 : 40;
    const vdot = estimateVdot(activities, hrMax, hrRest, today, previousVdot, fallbackVdot);
    const paces = trainingPaces(vdot.vdot);
    const week = prescribeWeek({ today, races, avgWeeklyKm28: loadMetrics.avgWeeklyKm28, km7: loadMetrics.km7, acwr: loadMetrics.acwr });
    const predictions = races.map((r) => ({
      name: r.name,
      distance_km: r.distance_km,
      predicted_s: predictRaceTime(vdot.vdot, r.distance_km * 1000),
      target_s: r.target_time_s,
    }));
    const runsPerWeek = loadMetrics.runs28 >= 4 ? Math.min(6, Math.max(4, Math.round(loadMetrics.runs28 / 4))) : 5;

    const workouts = buildPlan({
      today,
      vdot: vdot.vdot,
      previousVdot,
      paces,
      week,
      races,
      runsPerWeek,
      acwr: loadMetrics.acwr,
      previousPlan: prevPlan,
    });
    const assessment = assess({
      vdot: vdot.vdot,
      previousVdot,
      acwr: loadMetrics.acwr,
      km7: loadMetrics.km7,
      avgWeeklyKm28: loadMetrics.avgWeeklyKm28,
      daysSinceLastRun: loadMetrics.daysSinceLastRun,
      week,
    });

    let summary = assessment.summary;
    if (await getApiKey()) {
      try {
        const { data } = await generateJson({
          schema: NoteSchema,
          temperature: 0.6,
          system:
            'אתה מאמן ריצה חם ומקצועי. נסח מחדש את העובדות הבאות כהערת מאמן קצרה בעברית (2–3 משפטים), ' +
            'מעודדת וברורה. אל תוסיף ואל תשנה אף מספר, קצב או המלצה — רק נסח.',
          parts: [{ text: assessment.summary }],
        });
        if (data.summary.trim()) summary = data.summary.trim().slice(0, 600);
      } catch {}
    }

    const fullMarathon = races.find((r) => r.distance_km > 40);
    const shape = marathonShape(vdot.vdot, fullMarathon?.target_time_s ?? null, loadMetrics.longestRun28Km, loadMetrics.avgWeeklyKm28);

    // Keep the status of days already completed/skipped.
    const locked = new Set(prevPlan.filter((p) => p.status !== 'planned').map((p) => p.plan_date));
    const rows: CoachingPlan[] = workouts
      .filter((w) => !locked.has(w.date))
      .map((w) => ({
        id: w.date,
        plan_date: w.date,
        workout_type: w.workout_type,
        title: w.title,
        description: w.description,
        duration_min: w.duration_min,
        distance_km: w.distance_km,
        target_pace_fast_sec_km: w.target_pace_fast_sec_km,
        target_pace_slow_sec_km: w.target_pace_slow_sec_km,
        hr_zone: w.hr_zone,
        rationale: w.rationale,
        adaptation_note: w.adaptation_note,
        adjustment_sec: w.adjustment_sec,
        status: 'planned',
      }));
    const byDate = new Map(R.plans.map((p) => [p.plan_date, p]));
    for (const r of rows) byDate.set(r.plan_date, r);
    R.plans = [...byDate.values()].sort((a, b) => a.plan_date.localeCompare(b.plan_date));
    await saveDocs(C.plans, rows);

    const a: CoachAssessment = {
      id: `as_${Date.now().toString(36)}`,
      assessed_at: new Date().toISOString(),
      fatigue_level: assessment.fatigue_level,
      readiness_score: assessment.readiness_score,
      marathon_shape_pct: shape,
      acwr: loadMetrics.acwr,
      summary,
      vdot: vdot.vdot,
      vdot_source: vdot.source,
      training_paces: paces,
      race_predictions: predictions,
      phase: week.phase,
      weekly_km_target: week.weeklyKmTarget,
    };
    R.assessments.unshift(a);
    await saveDoc(C.assessments, a.id, a);
    markCompletedRuns();
    return a;
  } finally {
    useRun.setState({ recalibrating: false });
  }
}

/** Recalibrate once a day automatically (and after new runs arrive). */
export async function recalibrateIfStale() {
  const last = latestAssessment();
  const today = toISODate(new Date());
  const lastRun = R.activities[0]?.start_time;
  const stale = !last || last.assessed_at.slice(0, 10) !== today || (lastRun && lastRun > last.assessed_at);
  const hasHorizon = R.plans.some((p) => p.plan_date >= toISODate(new Date(Date.now() + 5 * 86_400_000)));
  if (stale || !hasHorizon) {
    try {
      await recalibratePlan();
    } catch (e) {
      console.warn('recalibrate failed', e);
    }
  }
}

// ---------------- stats (Stride web/src/lib/stats.ts) ----------------

function weekStartDate(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay());
  return out;
}

export function weeklyKm(weeks = 8, now = new Date()) {
  const current = weekStartDate(now);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(current);
    d.setDate(d.getDate() - 7 * (weeks - 1 - i));
    return { start: toISODate(d), km: 0, runs: 0, seconds: 0 };
  });
  for (const a of R.activities) {
    const ws = toISODate(weekStartDate(new Date(a.start_time)));
    const b = buckets.find((x) => x.start === ws);
    if (!b) continue;
    b.km += a.distance_m / 1000;
    b.runs++;
    b.seconds += a.duration_s;
  }
  return buckets.map((b) => ({ ...b, km: Math.round(b.km * 10) / 10 }));
}

/** Consecutive weeks (incl. current, if it already qualifies) with ≥ minRuns runs. */
export function runWeekStreak(minRuns = 3): number {
  const vols = weeklyKm(52).reverse();
  let streak = 0;
  for (let i = 0; i < vols.length; i++) {
    const ok = vols[i].runs >= minRuns;
    if (i === 0 && !ok) continue;
    if (!ok) break;
    streak++;
  }
  return streak;
}

// ---------------- import / export ----------------

export function exportRun() {
  return { profile: R.profile, activities: R.activities, plans: R.plans, assessments: R.assessments, races: R.races };
}

export async function importRun(d: Partial<RunState>) {
  if (d.profile) R.profile = { ...R.profile, ...d.profile };
  const merge = <T extends { id: string }>(cur: T[], inc?: T[]) => {
    const m = new Map(cur.map((x) => [x.id, x]));
    for (const x of inc ?? []) if (x?.id) m.set(x.id, x);
    return [...m.values()];
  };
  R.activities = merge(R.activities, d.activities);
  sortActs();
  R.plans = merge(R.plans, d.plans).sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  R.assessments = merge(R.assessments, d.assessments).sort((a, b) => b.assessed_at.localeCompare(a.assessed_at));
  R.races = merge(R.races, d.races).sort((a, b) => a.race_date.localeCompare(b.race_date));
  await Promise.all([
    saveDoc(C.meta, 'profile', R.profile),
    saveDocs(C.activities, R.activities),
    saveDocs(C.plans, R.plans),
    saveDocs(C.assessments, R.assessments),
    saveDocs(C.races, R.races),
  ]);
  emit();
}
