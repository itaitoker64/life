// Strength training state, ported from lift/js/store.js + db.js.
//
// Like Lift, the data lives in one mutable in-memory object that functions read synchronously;
// every change is written through to SQLite (one JSON document per record) and bumps a version
// counter so subscribed screens re-render.
import { create } from 'zustand';
import { deleteDoc, loadCollection, loadDoc, saveDoc, saveDocs } from '../db/docs';
import { useApp } from '../state/store';
import { DEFAULT_REP_RANGE, SEED_VERSION, builtinExercises, bundledRoutines } from './seed';
import {
  DEFAULT_SETTINGS,
  type ActiveWorkout,
  type Exercise,
  type LiftSettings,
  type Measurement,
  type Routine,
  type SetGroup,
  type SetType,
  type Workout,
  type WorkoutItem,
} from './types';
import { DAY, KG_PER_LB, deepClone, epley1RM, roundTo, uid, weekStart } from './utils';

export interface LiftState {
  settings: LiftSettings;
  exercises: Exercise[];
  routines: Routine[];
  workouts: Workout[];
  measurements: Measurement[];
  active: ActiveWorkout | null;
}

export const L: LiftState = {
  settings: { ...DEFAULT_SETTINGS },
  exercises: [],
  routines: [],
  workouts: [],
  measurements: [],
  active: null,
};

const C = {
  exercises: 'lift_exercises',
  routines: 'lift_routines',
  workouts: 'lift_workouts',
  measurements: 'lift_measurements',
  meta: 'lift_meta',
} as const;

export const useLift = create<{ version: number; ready: boolean }>(() => ({ version: 0, ready: false }));

/** Re-render subscribed screens after a data change. */
export function emit() {
  useLift.setState((s) => ({ version: s.version + 1 }));
}

/** Subscribe a component to strength data changes. */
export function useLiftVersion(): number {
  return useLift((s) => s.version);
}

function fail(e: unknown) {
  console.error('lift persist failed', e);
}

// ---------------- persistence ----------------

export const persist = {
  exercise: (e: Exercise) => saveDoc(C.exercises, e.id, e).catch(fail),
  routine: (r: Routine) => saveDoc(C.routines, r.id, r).catch(fail),
  workout: (w: Workout) => saveDoc(C.workouts, w.id, w).catch(fail),
  measurement: (m: Measurement) => saveDoc(C.measurements, m.id, m).catch(fail),
  settings: () => saveDoc(C.meta, 'settings', L.settings).catch(fail),
  active: () => saveDoc(C.meta, 'active', L.active).catch(fail),
};

let activeTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounced save of the live workout (typing a weight shouldn't hit the disk every keystroke). */
export function persistActiveSoon() {
  if (activeTimer) clearTimeout(activeTimer);
  activeTimer = setTimeout(() => {
    activeTimer = null;
    persist.active();
  }, 300);
}

export async function initLift(): Promise<void> {
  const [settings, exercises, routines, workouts, measurements, active] = await Promise.all([
    loadDoc<LiftSettings>(C.meta, 'settings'),
    loadCollection<Exercise>(C.exercises),
    loadCollection<Routine>(C.routines),
    loadCollection<Workout>(C.workouts),
    loadCollection<Measurement>(C.measurements),
    loadDoc<ActiveWorkout | null>(C.meta, 'active'),
  ]);
  L.settings = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
  L.exercises = exercises;
  L.routines = routines;
  L.workouts = workouts;
  L.measurements = measurements;
  L.active = active ?? null;

  // Merge built-ins: new ones are added, existing ones get updated metadata, custom edits to
  // name/note survive.
  if (L.settings.builtinVersion < SEED_VERSION || !L.exercises.length) {
    const byId = new Map(L.exercises.map((e) => [e.id, e]));
    const changed: Exercise[] = [];
    for (const b of builtinExercises()) {
      const cur = byId.get(b.id);
      if (!cur) {
        L.exercises.push(b);
        changed.push(b);
      } else if (!cur.isCustom) {
        Object.assign(cur, { ...b, name: cur.name || b.name, note: cur.note, createdAt: cur.createdAt });
        changed.push(cur);
      }
    }
    L.settings.builtinVersion = SEED_VERSION;
    await saveDocs(C.exercises, changed);
    await persist.settings();
  }

  // Bundled routines carry another lifter's weights, so new installs no longer receive them.
  // Existing copies are left alone; the combined program builds routines for this user.
  const seen = new Set([...(L.settings.bundledRoutines ?? []), ...bundledRoutines().map((b) => b.bundledKey)]);
  L.settings.bundledRoutines = [...seen];
  await persist.settings();
  useLift.setState((s) => ({ ready: true, version: s.version + 1 }));
}

// ---------------- units ----------------

export function unit(): 'kg' | 'lb' {
  return useApp.getState().profile?.units === 'imperial' ? 'lb' : 'kg';
}
export function unitLabel(): string {
  return unit() === 'lb' ? 'lb' : 'ק״ג';
}
/** kg → display units, rounded to 0.01. */
export function fmtW(kg: number | '' | null | undefined): number {
  if (kg == null || kg === '') return 0;
  const v = unit() === 'lb' ? Number(kg) / KG_PER_LB : Number(kg);
  return roundTo(v, 0.01);
}
export function fromDisplay(v: number): number {
  return unit() === 'lb' ? v * KG_PER_LB : v;
}

export function setSettings(patch: Partial<LiftSettings>) {
  Object.assign(L.settings, patch);
  persist.settings();
  emit();
}

// ---------------- exercises ----------------

export function exercises(): Exercise[] {
  return L.exercises.slice().sort((a, b) => exerciseName(a.id).localeCompare(exerciseName(b.id), 'he'));
}
export function exercise(id: string): Exercise | null {
  return L.exercises.find((e) => e.id === id) ?? null;
}
/** Hebrew name when there is one (custom exercises keep whatever name the user gave them). */
export function exerciseName(id: string): string {
  const e = exercise(id);
  if (!e) return 'תרגיל שנמחק';
  return e.nameHe || e.name;
}
export function exerciseSearchText(e: Exercise): string {
  return `${e.nameHe ?? ''} ${e.name} ${e.equipment} ${e.primary}`.toLowerCase();
}
export function addExercise(data: Partial<Exercise>): Exercise {
  const ex: Exercise = {
    id: uid(),
    name: (data.name || '').trim(),
    primary: data.primary || 'Other',
    equipment: data.equipment || 'Other',
    tracking: data.tracking || 'weight',
    isCustom: true,
    createdAt: Date.now(),
  };
  L.exercises.push(ex);
  persist.exercise(ex);
  emit();
  return ex;
}
export function updateExercise(id: string, patch: Partial<Exercise>) {
  const e = exercise(id);
  if (!e) return;
  Object.assign(e, patch);
  persist.exercise(e);
  emit();
}
export function deleteExercise(id: string) {
  L.exercises = L.exercises.filter((e) => e.id !== id);
  deleteDoc(C.exercises, id).catch(fail);
  emit();
}
export function exerciseUsedCount(id: string): number {
  let n = 0;
  for (const w of L.workouts) for (const it of w.items) if (it.exerciseId === id) n++;
  return n;
}

// ---------------- routines ----------------

export function routines(): Routine[] {
  return L.routines.slice().sort((a, b) => (a.order || 0) - (b.order || 0) || b.updatedAt - a.updatedAt);
}
export function routine(id: string): Routine | null {
  return L.routines.find((r) => r.id === id) ?? null;
}
export function saveRoutine(r: Partial<Routine>): Routine {
  const now = Date.now();
  const existing = r.id ? routine(r.id) : null;
  if (existing) {
    Object.assign(existing, r, { updatedAt: now });
    persist.routine(existing);
    emit();
    return existing;
  }
  const out: Routine = {
    name: 'רוטינה חדשה',
    notes: '',
    items: [],
    order: L.routines.length,
    createdAt: now,
    updatedAt: now,
    ...r,
    id: r.id || uid(),
  } as Routine;
  L.routines.push(out);
  persist.routine(out);
  emit();
  return out;
}
export function deleteRoutine(id: string) {
  L.routines = L.routines.filter((r) => r.id !== id);
  deleteDoc(C.routines, id).catch(fail);
  emit();
}
export function duplicateRoutine(id: string): Routine | null {
  const r = routine(id);
  if (!r) return null;
  const copy = deepClone(r);
  copy.id = uid();
  copy.name = `${r.name} (העתק)`;
  copy.createdAt = copy.updatedAt = Date.now();
  copy.order = L.routines.length;
  delete copy.bundledKey;
  L.routines.push(copy);
  persist.routine(copy);
  emit();
  return copy;
}
export function moveRoutine(id: string, dir: -1 | 1) {
  const list = routines();
  const i = list.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((r, k) => {
    if (r.order !== k) {
      r.order = k;
      persist.routine(r);
    }
  });
  emit();
}

// ---------------- workout history ----------------

export function workouts(): Workout[] {
  return L.workouts.slice().sort((a, b) => b.startedAt - a.startedAt);
}
export function workout(id: string): Workout | null {
  return L.workouts.find((w) => w.id === id) ?? null;
}
export function deleteWorkout(id: string) {
  L.workouts = L.workouts.filter((w) => w.id !== id);
  deleteDoc(C.workouts, id).catch(fail);
  emit();
}
export function commitWorkout(w: Workout) {
  L.workouts = L.workouts.filter((x) => x.id !== w.id);
  L.workouts.push(w);
  persist.workout(w);
  emit();
}
export function updateWorkout(w: Workout) {
  persist.workout(w);
  emit();
}

// ---------------- derived stats ----------------

export function itemVolume(item: WorkoutItem): number {
  let v = 0;
  for (const s of item.sets || []) {
    if (!s.done || s.type === 'warmup') continue;
    v += (Number(s.weight) || 0) * (Number(s.reps) || 0);
  }
  return v;
}
export function workoutVolume(w: Workout): number {
  return (w.items || []).reduce((n, it) => n + itemVolume(it), 0);
}
export function workoutSetCount(w: Workout): number {
  return (w.items || []).reduce((n, it) => n + (it.sets || []).filter((s) => s.done).length, 0);
}

export function exerciseBests(exId: string, exceptWorkoutId?: string) {
  let e1rm = 0, weight = 0, reps = 0, volume = 0, setVolume = 0;
  for (const w of L.workouts) {
    if (w.equipmentAdjusted || w.trainingKind && w.trainingKind !== 'strength' || exceptWorkoutId && w.id === exceptWorkoutId) continue;
    let wVol = 0;
    for (const it of w.items || []) {
      if (it.exerciseId !== exId) continue;
      for (const s of it.sets || []) {
        if (!s.done || s.type === 'warmup') continue;
        const wt = Number(s.weight) || 0;
        const rp = Number(s.reps) || 0;
        e1rm = Math.max(e1rm, epley1RM(wt, rp));
        weight = Math.max(weight, wt);
        reps = Math.max(reps, rp);
        setVolume = Math.max(setVolume, wt * rp);
        wVol += wt * rp;
      }
    }
    volume = Math.max(volume, wVol);
  }
  return { e1rm, weight, reps, volume, setVolume };
}

export function lastPerformance(exId: string, exceptWorkoutId?: string | null, skipDeload?: boolean) {
  for (const w of workouts()) {
    if (w.equipmentAdjusted || w.trainingKind && w.trainingKind !== 'strength' || exceptWorkoutId && w.id === exceptWorkoutId) continue;
    if (skipDeload && w.deload) continue;
    const it = (w.items || []).find((x) => x.exerciseId === exId);
    if (it) return { date: w.startedAt, sets: (it.sets || []).filter((s) => s.done) };
  }
  return null;
}

export function exerciseSeries(exId: string) {
  const points: Array<{ t: number; e1rm: number; weight: number; volume: number }> = [];
  for (const w of workouts().reverse()) {
    let top1 = 0, topW = 0, vol = 0;
    for (const it of w.items || []) {
      if (it.exerciseId !== exId) continue;
      for (const s of it.sets || []) {
        if (!s.done || s.type === 'warmup') continue;
        const wt = Number(s.weight) || 0;
        const rp = Number(s.reps) || 0;
        top1 = Math.max(top1, epley1RM(wt, rp));
        topW = Math.max(topW, wt);
        vol += wt * rp;
      }
    }
    if (top1 > 0 || vol > 0) points.push({ t: w.startedAt, e1rm: top1, weight: topW, volume: vol });
  }
  return points;
}

export function weeklyVolume(weeks = 12) {
  const map = new Map<number, { volume: number; sets: number; workouts: number; seconds: number }>();
  for (const w of L.workouts) {
    const k = weekStart(w.startedAt);
    const m = map.get(k) ?? { volume: 0, sets: 0, workouts: 0, seconds: 0 };
    m.volume += workoutVolume(w);
    m.sets += workoutSetCount(w);
    m.workouts += 1;
    m.seconds += w.durationSec || 0;
    map.set(k, m);
  }
  const out = [];
  const thisWeek = weekStart(Date.now());
  for (let i = weeks - 1; i >= 0; i--) {
    const k = weekStart(thisWeek - i * 7 * DAY + DAY); // DST-safe
    out.push({ t: k, volume: 0, sets: 0, workouts: 0, seconds: 0, ...(map.get(k) ?? {}) });
  }
  return out;
}

export function bestSet(item: WorkoutItem) {
  let best: { weight: number; reps: number } | null = null;
  for (const s of item.sets || []) {
    if (!s.done || s.type === 'warmup') continue;
    const w = Number(s.weight) || 0, r = Number(s.reps) || 0;
    if (!best || w > best.weight || (w === best.weight && r > best.reps)) best = { weight: w, reps: r };
  }
  return best;
}

export function recentPRs(limit = 5) {
  const out: Array<{ exerciseId: string; hits: string[]; t: number; workoutId: string }> = [];
  for (const w of workouts()) for (const p of w.prs || []) out.push({ exerciseId: p.exerciseId, hits: p.hits, t: w.startedAt, workoutId: w.id });
  return out.slice(0, limit);
}

export function workoutStreakDays(): number {
  if (!L.workouts.length) return 0;
  const days = new Set<number>();
  for (const w of L.workouts) {
    const d = new Date(w.startedAt);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  }
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  if (!days.has(cur.getTime())) cur.setDate(cur.getDate() - 1);
  while (days.has(cur.getTime())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export function setGroup(type: SetType | undefined): SetGroup {
  return type === 'warmup' || type === 'drop' ? type : 'work';
}

export function lastRepRange(exId: string) {
  for (const w of workouts()) {
    const it = (w.items || []).find((x) => x.exerciseId === exId && x.repMin);
    if (it) return { min: it.repMin!, max: it.repMax! };
  }
  return null;
}

export function defaultRepRange(exId: string) {
  const ex = exercise(exId);
  return lastRepRange(exId) ?? (ex && ex.repMin ? { min: ex.repMin, max: ex.repMax! } : DEFAULT_REP_RANGE);
}

/** Completed working sets per muscle for the week starting at `start` (live workout included). */
export function weeklyMuscleSets(start: number): Record<string, number> {
  const end = start + 7 * DAY;
  const counts: Record<string, number> = {};
  const add = (items: Array<{ exerciseId: string; sets: Array<{ done: boolean; type: SetType }> }>) => {
    for (const it of items || []) {
      const ex = exercise(it.exerciseId);
      const n = (it.sets || []).filter((s) => s.done && s.type !== 'warmup').length;
      if (!n) continue;
      const m = ex ? ex.primary : 'Other';
      counts[m] = (counts[m] || 0) + n;
      for (const sm of ex?.secondary ?? []) counts[sm] = (counts[sm] || 0) + n * 0.5;
    }
  };
  const a = L.active;
  for (const w of L.workouts) {
    if (a && a.resumed && w.id === a.id) continue;
    if (w.startedAt >= start && w.startedAt < end) add(w.items);
  }
  if (a && a.startedAt >= start && a.startedAt < end) add(a.items);
  return counts;
}

// ---------------- measurements ----------------

export function measurements(type?: string): Measurement[] {
  return L.measurements.filter((m) => !type || m.type === type).sort((a, b) => a.date - b.date);
}
export function addMeasurement(type: string, value: number, date = Date.now()): Measurement {
  const m: Measurement = { id: uid(), type, value: Number(value), date };
  L.measurements.push(m);
  persist.measurement(m);
  emit();
  return m;
}
export function deleteMeasurement(id: string) {
  L.measurements = L.measurements.filter((m) => m.id !== id);
  deleteDoc(C.measurements, id).catch(fail);
  emit();
}

// ---------------- import / export ----------------

export function exportAll() {
  return {
    app: 'lift',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      settings: L.settings,
      exercises: L.exercises,
      routines: L.routines,
      workouts: L.workouts,
      measurements: L.measurements,
    },
  };
}

/** Imports a Lift backup file (Settings → Export in Lift). Merge keeps existing records. */
export async function importLift(obj: any, mode: 'merge' | 'replace' = 'merge') {
  if (!obj || !obj.data) throw new Error('הקובץ לא נראה כמו גיבוי של Lift');
  const d = obj.data;
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  const counts = { workouts: 0, routines: 0, exercises: 0, measurements: 0 };
  const merge = <T extends { id: string }>(cur: T[], incoming: T[]): T[] => {
    if (mode === 'replace') return incoming.filter((x) => x && x.id);
    const map = new Map(cur.map((x) => [x.id, x]));
    for (const x of incoming) if (x && x.id) map.set(x.id, x);
    return [...map.values()];
  };
  // Lift's built-in exercises lack Hebrew names; keep ours for those ids.
  const builtins = new Map(builtinExercises().map((e) => [e.id, e]));
  const incomingEx = arr<Exercise>(d.exercises).map((e) => (builtins.has(e.id) && !e.isCustom ? { ...builtins.get(e.id)!, note: e.note } : e));
  L.exercises = merge(L.exercises, incomingEx);
  for (const b of builtins.values()) if (!L.exercises.some((e) => e.id === b.id)) L.exercises.push(b);
  L.routines = merge(L.routines, arr<Routine>(d.routines));
  L.workouts = merge(L.workouts, arr<Workout>(d.workouts));
  L.measurements = merge(L.measurements, arr<Measurement>(d.measurements));
  counts.workouts = arr(d.workouts).length;
  counts.routines = arr(d.routines).length;
  counts.exercises = incomingEx.filter((e) => e.isCustom).length;
  counts.measurements = arr(d.measurements).length;
  if (d.settings) {
    const s = d.settings as Partial<LiftSettings>;
    Object.assign(L.settings, {
      defaultRestSec: s.defaultRestSec ?? L.settings.defaultRestSec,
      incKg: s.incKg ?? L.settings.incKg,
      incLb: s.incLb ?? L.settings.incLb,
      weeklyGoal: s.weeklyGoal ?? L.settings.weeklyGoal,
      calibrations: s.calibrations ?? L.settings.calibrations,
      lastDeloadEnd: s.lastDeloadEnd ?? L.settings.lastDeloadEnd,
      deload: s.deload ?? L.settings.deload,
    });
  }
  await saveDocs(C.exercises, L.exercises);
  await saveDocs(C.routines, L.routines);
  await saveDocs(C.workouts, L.workouts);
  await saveDocs(C.measurements, L.measurements);
  await persist.settings();
  emit();
  return counts;
}

export async function wipeLift() {
  const { clearCollection } = await import('../db/docs');
  await Promise.all(Object.values(C).map((c) => clearCollection(c)));
  L.settings = { ...DEFAULT_SETTINGS };
  L.exercises = [];
  L.routines = [];
  L.workouts = [];
  L.measurements = [];
  L.active = null;
  await initLift();
}
