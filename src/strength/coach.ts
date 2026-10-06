// Training logic beyond logging, ported from lift/js/coach.js:
//   - load or rep progression grow muscle equally when sets are hard (Plotkin 2022);
//     hard = ~0–3 reps in reserve (Refalo 2023)
//   - RIR self-estimates are off by ~1 rep (Halperin 2022), so effort is a 3-way choice
//   - scheduled deloads didn't add muscle (Coleman 2024), so deloads are suggested only on fatigue
//   - systematic exercise variation helps (Kassiano 2022)
import {
  L,
  emit,
  exercise,
  exerciseName,
  exercises,
  lastPerformance,
  persist,
  setGroup,
  setSettings,
  unit,
  workouts,
} from './store';
import type { Effort, Exercise, LiveItem, LiveSet, Num, WorkoutItem } from './types';
import { DAY, KG_PER_LB } from './utils';

const EFFORT_RIR: Record<Effort, number> = { easy: 4, good: 2, fail: 0 };
const DEFAULT_RIR = 2;

export const EFFORTS: Array<{ key: Effort; label: string; sub: string }> = [
  { key: 'easy', label: 'קל', sub: 'נשארו 4+' },
  { key: 'good', label: 'טוב', sub: 'נשארו 1–3' },
  { key: 'fail', label: 'כשל', sub: 'לא נשאר' },
];

// ---------- deload state ----------
export function deloadActive(): boolean {
  const d = L.settings.deload;
  return !!(d && Date.now() < d.end);
}
export function deloadDaysLeft(): number {
  const d = L.settings.deload;
  return d ? Math.max(0, Math.ceil((d.end - Date.now()) / DAY)) : 0;
}
export function startDeload() {
  setSettings({ deload: { start: Date.now(), end: Date.now() + 7 * DAY }, deloadSnoozeUntil: 0 });
}
export function endDeload() {
  setSettings({ deload: null, lastDeloadEnd: Date.now() });
}
export function snoozeDeload() {
  setSettings({ deloadSnoozeUntil: Date.now() + 7 * DAY });
}

// ---------- history helpers ----------
type AnySet = { type: LiveSet['type']; weight: Num | number; reps: Num | number; done: boolean; effort?: Effort };

function workingSets(item: WorkoutItem) {
  return (item.sets || []).filter((s) => s.done && setGroup(s.type) === 'work' && Number(s.reps) > 0);
}

interface Session {
  t: number;
  workoutId: string;
  sets: WorkoutItem['sets'];
  e1: number;
}

/** Sessions (newest first) with completed working sets; deload weeks left out. */
export function sessions(exId: string, sinceDays?: number): Session[] {
  const since = sinceDays ? Date.now() - sinceDays * DAY : 0;
  const out: Session[] = [];
  for (const w of workouts()) {
    if (w.deload || w.equipmentAdjusted || w.trainingKind && w.trainingKind !== 'strength' || w.startedAt < since) continue;
    const it = (w.items || []).find((x) => x.exerciseId === exId);
    if (!it) continue;
    const sets = workingSets(it);
    if (!sets.length) continue;
    out.push({ t: w.startedAt, workoutId: w.id, sets, e1: bestE1(sets) });
  }
  return out;
}

function bestE1(sets: Array<{ weight: number; reps: number }>) {
  let b = 0;
  for (const s of sets) {
    const w = Number(s.weight) || 0, r = Number(s.reps) || 0;
    if (w && r) b = Math.max(b, r <= 1 ? w : w * (1 + r / 30));
  }
  return b;
}

/** Effective reps-in-reserve of set i (a "Good" set followed by a rep crash was harder). */
export function rirOf(sets: AnySet[], i: number): number {
  const s = sets[i];
  let rir = s.effort ? EFFORT_RIR[s.effort] : DEFAULT_RIR;
  const next = sets[i + 1];
  if (
    next &&
    s.effort !== 'fail' &&
    setGroup(next.type) === 'work' &&
    Math.abs((Number(next.weight) || 0) - (Number(s.weight) || 0)) < 0.01 &&
    (Number(s.reps) || 0) - (Number(next.reps) || 0) >= 3
  ) {
    rir = Math.min(rir, 1);
  }
  return rir;
}

function stepKg() {
  return unit() === 'lb' ? (L.settings.incLb || 5) * KG_PER_LB : L.settings.incKg || 2.5;
}
const roundStep = (w: number, step: number) => Math.round(w / step) * step;

export type TargetKind = 'weight' | 'down' | 'reps' | 'deload' | 'same';
export interface Target {
  weight: Num | number;
  reps: Num | number;
  kind: TargetKind;
  prevWeight?: number;
  prevReps?: number;
  prevEffort?: Effort | null;
}

/** Next-session target for one working set. */
export function nextTarget(prev: AnySet, rir: number, repMin: number, repMax: number): Target {
  const w = Number(prev.weight) || 0, r = Number(prev.reps) || 0;
  const step = stepKg();
  if (deloadActive()) return { weight: prev.weight, reps: prev.reps, kind: 'deload' };
  if (!w) return { weight: prev.weight, reps: r + (prev.effort === 'easy' ? 2 : 1), kind: 'reps' };
  const e1 = w * (1 + (r + rir) / 30);
  const loadFor = (reps: number, atRir: number) => e1 / (1 + (reps + atRir) / 30);

  if (r < repMin) {
    let nw = roundStep(loadFor(repMin, 2), step);
    if (nw >= w) return { weight: prev.weight, reps: repMin, kind: 'reps' };
    nw = Math.max(nw, roundStep(w * 0.85, step));
    return { weight: nw, reps: repMin, kind: 'down' };
  }
  if (prev.effort === 'easy') {
    const reps = r >= repMax ? repMin : r;
    let nw = roundStep(loadFor(reps, 2), step);
    nw = Math.min(Math.max(nw, w + step), Math.max(w + step, roundStep(w * 1.1, step)));
    return { weight: nw, reps, kind: 'weight' };
  }
  if (r >= repMax) return { weight: w + step, reps: repMin, kind: 'weight' };
  return { weight: prev.weight, reps: Math.min(repMax, r + 1), kind: 'reps' };
}

export interface ProgressionPlan {
  byType: Partial<Record<'work' | 'warmup' | 'drop', Target[]>>;
  counts: { weight: number; down: number; reps: number; deload: number };
}

/** Next-session plan from the last (non-deload) session, matched set-by-set within each group. */
export function progressionPlan(exId: string, repMin: number, repMax: number, exceptWorkoutId?: string | null): ProgressionPlan | null {
  const ex = exercise(exId);
  if (ex && ex.tracking === 'cardio') return null;
  const last = lastPerformance(exId, exceptWorkoutId, true);
  if (!last || !last.sets.length) return null;
  const byType: ProgressionPlan['byType'] = {};
  const counts = { weight: 0, down: 0, reps: 0, deload: 0 };
  last.sets.forEach((s, i) => {
    const g = setGroup(s.type);
    const r = Number(s.reps) || 0;
    let target: Target;
    if (g !== 'work' || !r) {
      target = { weight: s.weight, reps: s.reps, kind: 'same' };
    } else {
      target = nextTarget(s, rirOf(last.sets, i), repMin, repMax);
      if (target.kind !== 'same') counts[target.kind]++;
    }
    target.prevWeight = Number(s.weight) || 0;
    target.prevReps = r;
    target.prevEffort = s.effort ?? null;
    (byType[g] = byType[g] || []).push(target);
  });
  if (!byType.work) return null;
  return { byType, counts };
}

// ---------- stalls ----------
export type Trend =
  | { status: 'new'; sessions: number }
  | { status: 'stalled'; sessions: number; stalledFor: number; change: number }
  | { status: 'progressing' | 'steady'; sessions: number; change: number };

export function trend(exId: string): Trend {
  const ss = sessions(exId, 120);
  if (ss.length < 4) return { status: 'new', sessions: ss.length };
  const recent = ss.slice(0, 3), before = ss.slice(3);
  const recentBest = Math.max(...recent.map((s) => s.e1));
  const beforeBest = Math.max(...before.map((s) => s.e1));
  const change = beforeBest ? (recentBest - beforeBest) / beforeBest : 0;
  if (recentBest <= beforeBest * 1.005) {
    let n = 0;
    for (let i = 0; i < ss.length - 1; i++) {
      const prior = Math.max(...ss.slice(i + 1).map((s) => s.e1));
      if (ss[i].e1 <= prior * 1.005) n++;
      else break;
    }
    return { status: 'stalled', sessions: ss.length, stalledFor: Math.max(3, n), change };
  }
  return { status: ss[0].e1 > beforeBest ? 'progressing' : 'steady', sessions: ss.length, change };
}

/** Same-muscle alternatives: same movement pattern, then lengthened, then different equipment. */
export function alternatives(exId: string, excludeIds: string[] = [], n = 3): Exercise[] {
  const ex = exercise(exId);
  if (!ex) return [];
  const sig = (e: Exercise) => (e.secondary || []).slice().sort().join(',');
  const score = (e: Exercise) => (sig(e) === sig(ex) ? 4 : 0) + (e.lengthened ? 2 : 0) + (e.equipment !== ex.equipment ? 1 : 0);
  return exercises()
    .filter((e) => e.id !== exId && e.primary === ex.primary && e.tracking !== 'cardio' && !excludeIds.includes(e.id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

// ---------- fatigue → deload suggestion ----------
export function fatigue() {
  const res = { suggest: false, reasons: [] as string[], dropped: [] as string[], snoozed: false };
  if (deloadActive()) return res;
  const now = Date.now();
  const quietSince = Math.max(L.settings.lastDeloadEnd || 0, 0);
  if (now - quietSince < 14 * DAY) return res;

  const seen = new Set<string>();
  for (const w of workouts()) {
    if (w.deload || w.startedAt < now - 7 * DAY || w.startedAt < quietSince) continue;
    for (const it of w.items || []) {
      if (seen.has(it.exerciseId)) continue;
      const ss = sessions(it.exerciseId, 90);
      const idx = ss.findIndex((s) => s.workoutId === w.id);
      if (idx < 0) continue;
      const prior = ss.slice(idx + 1, idx + 4);
      if (prior.length < 2) continue;
      seen.add(it.exerciseId);
      const avg = prior.reduce((n, s) => n + s.e1, 0) / prior.length;
      if (ss[idx].e1 < avg * 0.95) res.dropped.push(it.exerciseId);
    }
  }
  if (res.dropped.length >= 2) {
    res.reasons.push(`הביצועים ירדו ב-${res.dropped.length} תרגילים השבוע (${res.dropped.slice(0, 3).map(exerciseName).join(', ')})`);
  }

  let marked = 0, fails = 0;
  for (const w of workouts()) {
    if (w.deload || w.startedAt < now - 14 * DAY) continue;
    for (const it of w.items || [])
      for (const s of workingSets(it))
        if (s.effort) {
          marked++;
          if (s.effort === 'fail') fails++;
        }
  }
  const grinding = marked >= 15 && fails / marked >= 0.5;
  if (grinding) res.reasons.push(`${Math.round((fails / marked) * 100)}% מהסטים בשבועיים האחרונים הגיעו לכשל`);

  res.suggest = res.dropped.length >= 2 || grinding;
  if (res.suggest && (L.settings.deloadSnoozeUntil || 0) > now) res.snoozed = true;
  return res;
}

// ---------- failure checks ----------
export function safeToFail(ex: Exercise | null): boolean {
  if (!ex || ex.tracking === 'cardio') return false;
  if (ex.equipment === 'Machine' || ex.equipment === 'Cable') return true;
  if (ex.equipment === 'Barbell') return false;
  return ['Biceps', 'Triceps', 'Shoulders', 'Calves', 'Abs', 'Forearms'].includes(ex.primary);
}

export function failureCheckDue(exId: string): boolean {
  if (deloadActive()) return false;
  const ex = exercise(exId);
  if (!safeToFail(ex)) return false;
  const ss = sessions(exId, 365);
  if (ss.length < 2) return false;
  const lastFail = ss.find((s) => s.sets.some((x) => x.effort === 'fail'));
  return !lastFail || Date.now() - lastFail.t > 28 * DAY;
}

export function calibrate(sets: LiveSet[], failIdx: number) {
  const f = sets[failIdx];
  for (let i = failIdx - 1; i >= 0; i--) {
    const p = sets[i];
    if (!p.done || setGroup(p.type) !== 'work' || !p.effort || p.effort === 'fail') continue;
    if (Math.abs((Number(p.weight) || 0) - (Number(f.weight) || 0)) > 0.01) return null;
    const predictedMax = (Number(p.reps) || 0) + EFFORT_RIR[p.effort];
    const gap = (Number(f.reps) || 0) - predictedMax;
    return { gap, said: p.effort, prevReps: Number(p.reps) || 0, failReps: Number(f.reps) || 0 };
  }
  return null;
}

export function recordCalibration(exId: string, result: { gap: number }) {
  const list = (L.settings.calibrations || []).slice(-19);
  list.push({ t: Date.now(), exId, gap: result.gap });
  L.settings.calibrations = list;
  persist.settings();
  emit();
}

// ---------- weekly coach summary ----------
export function summary() {
  const ids = new Set<string>();
  for (const w of workouts()) {
    if (w.startedAt < Date.now() - 42 * DAY) continue;
    for (const it of w.items || []) ids.add(it.exerciseId);
  }
  const progressing: Array<{ id: string; change: number }> = [];
  const stalled: Array<{ id: string; stalledFor: number }> = [];
  const due: string[] = [];
  const longRunning: Array<{ id: string; weeks: number }> = [];
  for (const id of ids) {
    const t = trend(id);
    if (t.status === 'progressing') progressing.push({ id, change: t.change });
    if (t.status === 'stalled') stalled.push({ id, stalledFor: t.stalledFor });
    if (failureCheckDue(id)) due.push(id);
    const ss = sessions(id, 120);
    if (t.status !== 'progressing' && t.status !== 'stalled' && ss.length >= 6 && ss[ss.length - 1].t <= Date.now() - 56 * DAY) {
      longRunning.push({ id, weeks: Math.round((Date.now() - ss[ss.length - 1].t) / (7 * DAY)) });
    }
  }
  progressing.sort((a, b) => b.change - a.change);
  return { progressing, stalled, failureDue: due, longRunning, fatigue: fatigue() };
}

/** One-line status for the coach card. */
export function summaryLine(): string {
  const s = summary();
  const bits: string[] = [];
  if (deloadActive()) bits.push('שבוע דילואוד');
  if (s.progressing.length) bits.push(`${s.progressing.length} בהתקדמות`);
  if (s.stalled.length) bits.push(`${s.stalled.length} תקועים`);
  if (s.failureDue.length) bits.push(`${s.failureDue.length} בדיקות כשל`);
  if (s.longRunning.length) bits.push(`${s.longRunning.length} להחלפה`);
  if (!bits.length) {
    bits.push(workouts().length < 4 ? 'לומד את האימונים שלך — תובנות אחרי כמה אימונים' : 'הכול טוב — אין מה לתקן');
  }
  return bits.join(' · ');
}

export type { LiveItem };
