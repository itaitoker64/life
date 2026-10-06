import { reducedStrengthItems } from '../planning/adaptation';
import { plannedSessions } from '../planning/model';
import { usePlanning } from '../planning/store';
import { R } from '../run/store';
import { today } from '../lib/dates';
// Live workout logic, ported from lift/js/views/workout.js and views/home.js (everything that
// isn't rendering). Screens call these and then emit() to re-render.
import * as Notifications from 'expo-notifications';
import {
  deloadActive,
  failureCheckDue,
  progressionPlan,
} from './coach';
import {
  L,
  commitWorkout,
  deleteWorkout,
  defaultRepRange,
  emit,
  exercise,
  exerciseBests,
  exerciseName,
  fmtW,
  lastPerformance,
  persist,
  persistActiveSoon,
  routine,
  routines,
  saveRoutine,
  setGroup,
  unitLabel,
  workouts,
} from './store';
import type { ActiveWorkout, LiveItem, LiveSet, Routine, RoutineItem, Workout } from './types';
import { DAY, WEEK, clamp, deepClone, epley1RM, fmtClock, fmtNum, uid, weekStart } from './utils';

export const SET_TYPES: LiveSet['type'][] = ['normal', 'warmup', 'drop', 'fail'];
export const SET_GLYPH: Record<string, string | null> = { normal: null, warmup: 'ח', drop: 'D', fail: 'F' };
export const SET_TYPE_HE: Record<string, string> = { normal: 'רגיל', warmup: 'חימום', drop: 'דרופ', fail: 'כשל' };

export function defaultName(): string {
  const h = new Date().getHours();
  return h < 12 ? 'אימון בוקר' : h < 17 ? 'אימון צהריים' : h < 21 ? 'אימון ערב' : 'אימון לילה';
}

function newActive(name?: string, routineId?: string | null): ActiveWorkout {
  return { id: uid(), name: name || defaultName(), routineId: routineId || null, startedAt: Date.now(), items: [], rest: null };
}

export function setsFromLast(exId: string): LiveSet[] {
  const last = lastPerformance(exId);
  if (last && last.sets.length) return last.sets.map((s) => ({ type: s.type || 'normal', weight: s.weight, reps: s.reps, done: false }));
  return [{ type: 'normal', weight: '', reps: '', done: false }];
}

function repRangeFor(exId: string, src?: { repMin?: number; repMax?: number }) {
  if (src && src.repMin) return { min: src.repMin, max: src.repMax! };
  return defaultRepRange(exId);
}

/** Pre-fill not-yet-done sets from the progression plan (matched by position within set group). */
export function applyTarget(item: LiveItem, exceptWorkoutId: string | null) {
  const plan = progressionPlan(item.exerciseId, item.repMin, item.repMax, exceptWorkoutId);
  if (!plan) {
    autoWarmups(item);
    return;
  }
  const pos: Record<string, number> = {};
  for (const s of item.sets) {
    const g = setGroup(s.type);
    const i = pos[g] || 0;
    pos[g] = i + 1;
    const list = plan.byType[g];
    if (s.done || !list) continue;
    const t = list[Math.min(i, list.length - 1)];
    s.weight = t.weight as LiveSet['weight'];
    s.reps = t.reps as LiveSet['reps'];
  }
  autoWarmups(item);
}

// Warm-ups ramp to today's first working weight: few reps, rising load.
const RAMP: Record<number, Array<[number, number]>> = {
  1: [[0.6, 6]],
  2: [[0.5, 8], [0.75, 4]],
  3: [[0.45, 8], [0.65, 5], [0.85, 3]],
  4: [[0.4, 8], [0.55, 6], [0.7, 4], [0.85, 2]],
};
export function warmupCount(kg: number) {
  return kg >= 60 ? 3 : kg >= 25 ? 2 : 1;
}
export function autoWarmups(item: LiveItem): boolean {
  const work = item.sets.find((s) => setGroup(s.type) === 'work' && Number(s.weight) > 0);
  if (!work) return false;
  const W = Number(work.weight);
  const warm = item.sets.filter((s) => s.type === 'warmup');
  const ramp = RAMP[Math.min(warm.length, 4)];
  if (!ramp) return false;
  const step = W % 2.5 === 0 ? 2.5 : W % 2 === 0 ? 2 : 1;
  const ex = exercise(item.exerciseId);
  const floor = ex && ex.equipment === 'Barbell' ? 20 : step;
  warm.forEach((s, i) => {
    if (s.done || !ramp[i]) return;
    s.weight = Math.min(W, Math.max(floor, Math.round((W * ramp[i][0]) / step) * step));
    s.reps = ramp[i][1];
  });
  return true;
}

/** Deload week: same weights, half the working sets, no drop sets. */
function halveForDeload(item: LiveItem) {
  const work = item.sets.filter((s) => setGroup(s.type) === 'work').length;
  const keep = Math.ceil(work / 2);
  let seen = 0;
  item.sets = item.sets.filter((s) => {
    const g = setGroup(s.type);
    if (g === 'warmup') return true;
    if (g === 'drop') return false;
    return ++seen <= keep;
  });
}

export function newItem(exId: string, fields: Partial<LiveItem> & { sets?: LiveSet[] }): LiveItem {
  const rr = repRangeFor(exId, fields);
  const item: LiveItem = {
    exerciseId: exId,
    notes: '',
    restSec: L.settings.defaultRestSec,
    sets: [{ type: 'normal', weight: '', reps: '', done: false }],
    ...fields,
    repMin: rr.min,
    repMax: rr.max,
  };
  applyTarget(item, null);
  if (deloadActive()) halveForDeload(item);
  return item;
}

function itemFromRoutine(rit: RoutineItem): LiveItem {
  return newItem(rit.exerciseId, {
    superset: rit.superset || undefined,
    notes: rit.notes || '',
    restSec: rit.restSec != null ? rit.restSec : L.settings.defaultRestSec,
    repMin: rit.repMin,
    repMax: rit.repMax,
    sets: (rit.sets && rit.sets.length ? rit.sets : [{ type: 'normal' as const, weight: '' as const, reps: '' as const }]).map((s) => ({
      type: s.type || 'normal',
      weight: s.weight,
      reps: s.reps,
      done: false,
    })),
  });
}

/** Seconds trained (a resumed workout counts its earlier part plus time since resuming). */
export function elapsedSec(a: ActiveWorkout): number {
  if (a.resumedAt) return (a.priorDurationSec || 0) + (Date.now() - a.resumedAt) / 1000;
  return (Date.now() - a.startedAt) / 1000;
}

const RESUME_WINDOW_MS = 24 * 3600 * 1000;
export function canResume(w: Workout | null): boolean {
  return !!w && Date.now() - (w.endedAt || w.startedAt) < RESUME_WINDOW_MS;
}

function setActive(a: ActiveWorkout | null) {
  L.active = a;
  persist.active();
  emit();
}

/** Reopen a finished workout; routine exercises/sets not reached are added back. */
export function resumeFinished(w: Workout) {
  const a: ActiveWorkout = {
    id: w.id,
    name: w.name,
    routineId: w.routineId || null,
    startedAt: w.startedAt,
    resumedAt: Date.now(),
    priorDurationSec: w.durationSec || 0,
    resumed: true,
    adaptationDeload: w.deload,
    failChecksAssigned: true,
    rest: null,
    items: w.items.map((it) => ({
      exerciseId: it.exerciseId,
      notes: it.notes || '',
      restSec: it.restSec || 0,
      repMin: it.repMin ?? defaultRepRange(it.exerciseId).min,
      repMax: it.repMax ?? defaultRepRange(it.exerciseId).max,
      superset: it.superset || undefined,
      sets: it.sets.map((s) => ({ ...s, done: true })),
    })),
  };
  const r = a.routineId ? routine(a.routineId) : null;
  if (r) {
    for (const ri of r.items) {
      const it = a.items.find((x) => x.exerciseId === ri.exerciseId);
      if (!it) {
        a.items.push(itemFromRoutine(ri));
        continue;
      }
      const done: Record<string, number> = {};
      for (const s of it.sets) {
        const g = setGroup(s.type);
        done[g] = (done[g] || 0) + 1;
      }
      const seen: Record<string, number> = {};
      for (const rs of ri.sets) {
        const g = setGroup(rs.type || 'normal');
        seen[g] = (seen[g] || 0) + 1;
        if (seen[g] > (done[g] || 0)) it.sets.push({ type: rs.type || 'normal', weight: rs.weight, reps: rs.reps, done: false });
      }
      applyTarget(it, w.id);
    }
  }
  setActive(a);
}

export function startEmpty() {
  setActive(newActive());
}

export function startFromRoutine(routineId: string) {
  const r = routine(routineId);
  if (!r) return;
  const a = newActive(r.name, routineId);
  a.items = r.items.map(itemFromRoutine);
  const planned = plannedSessions(usePlanning.getState().data, R.plans, today(), today()).find(s => s.routineId === routineId && s.status !== 'completed');
  if (planned?.adjustment?.mode === 'reduce') {
    const factor = planned.adjustment.factor ?? 0.7;
    a.name = `${r.name} · עומס מופחת`;
    a.failChecksAssigned = true;
    a.adaptationDeload = true;
    a.items = reducedStrengthItems(a.items, factor);
    a.items.forEach(autoWarmups);
  }
  setActive(a);
}

/** Once per workout, flag up to two safe exercises for a failure check. */
export function assignFailureChecks(a: ActiveWorkout) {
  if (a.failChecksAssigned) return;
  a.failChecksAssigned = true;
  a.items
    .filter((it) => failureCheckDue(it.exerciseId))
    .slice(0, 2)
    .forEach((it) => (it._failCheck = true));
  persist.active();
}

export function endActive() {
  cancelRestAlert(L.active);
  setActive(null);
}

// ---------------- rest timer ----------------

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export async function cancelRestAlert(a: ActiveWorkout | null) {
  const id = a?.rest?.notificationId;
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

export async function scheduleRestAlert(a: ActiveWorkout) {
  if (!a.rest) return;
  await cancelRestAlert(a);
  const seconds = Math.round((a.rest.endsAt - Date.now()) / 1000);
  if (seconds < 1) return;
  if (!(await ensureNotificationPermission())) return;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'המנוחה נגמרה', body: nextSetText(a), sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'rest' },
    });
    if (a.rest) a.rest.notificationId = id;
    persistActiveSoon();
  } catch (e) {
    console.warn('rest notification failed', e);
  }
}

export function startRest(a: ActiveWorkout, sec: number) {
  if (!sec) return;
  cancelRestAlert(a);
  a.rest = { endsAt: Date.now() + sec * 1000, duration: sec };
  persistActiveSoon();
  scheduleRestAlert(a);
}

export function stopRest(a: ActiveWorkout) {
  cancelRestAlert(a);
  a.rest = null;
  persistActiveSoon();
}

export function bumpRest(a: ActiveWorkout, delta: number) {
  if (!a.rest) return;
  a.rest.endsAt = Math.max(Date.now(), a.rest.endsAt + delta * 1000);
  a.rest.duration = Math.max(a.rest.duration, (a.rest.endsAt - Date.now()) / 1000);
  persistActiveSoon();
  scheduleRestAlert(a);
}

/** "לחיצת חזה · סט 3: 62.5 ק״ג × 8" for the notification body. */
export function nextSetText(a: ActiveWorkout): string {
  for (const it of a.items) {
    const si = it.sets.findIndex((s) => !s.done);
    if (si < 0) continue;
    const s = it.sets[si];
    const load = s.weight !== '' && s.reps !== '' && s.weight != null ? `: ${fmtNum(fmtW(s.weight))} ${unitLabel()} × ${s.reps}` : '';
    return `${exerciseName(it.exerciseId)} · סט ${si + 1}${load}`;
  }
  return 'כל הסטים הושלמו — אפשר לסיים';
}

// ---------------- supersets ----------------

export const SS_COLORS = ['#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#38bdf8'];

type SsItem = { exerciseId: string; superset?: string };

export const ss = {
  tidy<T extends SsItem>(items: T[]): T[] {
    const count: Record<string, number> = {};
    for (const it of items) if (it.superset) count[it.superset] = (count[it.superset] || 0) + 1;
    for (const it of items) if (it.superset && count[it.superset] < 2) delete it.superset;
    const out: T[] = [];
    const placed = new Set<string>();
    for (const it of items) {
      if (!it.superset) {
        out.push(it);
        continue;
      }
      if (placed.has(it.superset)) continue;
      placed.add(it.superset);
      for (const x of items) if (x.superset === it.superset) out.push(x);
    }
    items.length = 0;
    items.push(...out);
    return items;
  },
  members<T extends SsItem>(items: T[], it: T): T[] {
    return it.superset ? items.filter((x) => x.superset === it.superset) : [it];
  },
  index(items: SsItem[], it: SsItem): number {
    const seen: string[] = [];
    for (const x of items) if (x.superset && !seen.includes(x.superset)) seen.push(x.superset);
    return seen.indexOf(it.superset!);
  },
  color(items: SsItem[], it: SsItem): string {
    return SS_COLORS[ss.index(items, it) % SS_COLORS.length];
  },
  label(items: SsItem[], it: SsItem): string {
    return `סופרסט ${String.fromCharCode(65 + ss.index(items, it))}`;
  },
  signature(items: SsItem[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const it of items) {
      out[it.exerciseId] = ss
        .members(items, it)
        .map((x) => x.exerciseId)
        .filter((id) => id !== it.exerciseId)
        .sort()
        .join(',');
    }
    return out;
  },
  /** Pair `it` with `partner` (new pair, or join the partner's group). */
  link<T extends SsItem>(items: T[], it: T, partner: T) {
    if (!partner.superset) {
      partner.superset = it.superset = 'ss' + uid();
      items.splice(items.indexOf(partner), 1);
      items.splice(items.indexOf(it) + 1, 0, partner);
    } else {
      it.superset = partner.superset;
      items.splice(items.indexOf(it), 1);
      let at = items.indexOf(partner);
      while (at + 1 < items.length && items[at + 1].superset === partner.superset) at++;
      items.splice(at + 1, 0, it);
    }
    ss.tidy(items);
  },
  unlink<T extends SsItem>(items: T[], it: T) {
    delete it.superset;
    ss.tidy(items);
  },
};

/** In a superset, the next member still behind on this round (null = round done → rest). */
export function supersetNext(a: ActiveWorkout, it: LiveItem): LiveItem | null {
  if (!it.superset) return null;
  const m = ss.members(a.items, it);
  const doneN = (x: LiveItem) => x.sets.filter((s) => s.done).length;
  const mine = doneN(it);
  for (let k = m.indexOf(it) + 1; k < m.length; k++) {
    if (doneN(m[k]) < mine && m[k].sets.some((s) => !s.done)) return m[k];
  }
  return null;
}

// ---------------- PRs ----------------

/** Live PR check against history plus other completed sets of this exercise in the workout. */
export function checkPR(a: ActiveWorkout, exId: string, st: LiveSet): string | null {
  const w = Number(st.weight) || 0, r = Number(st.reps) || 0;
  if (!w || !r) return null;
  const b = exerciseBests(exId, a.id);
  let e1Best = b.e1rm, wBest = b.weight;
  for (const it of a.items) {
    if (it.exerciseId !== exId) continue;
    for (const s of it.sets) {
      if (s === st || !s.done || s.type === 'warmup') continue;
      const sw = Number(s.weight) || 0;
      e1Best = Math.max(e1Best, epley1RM(sw, Number(s.reps) || 0));
      wBest = Math.max(wBest, sw);
    }
  }
  if (epley1RM(w, r) > e1Best + 0.01) return 'שיא 1RM משוער';
  if (w > wBest + 0.01) return 'שיא משקל';
  return null;
}

// ---------------- finishing ----------------

function typeSig(sets: Array<{ type?: string }>) {
  return sets.map((s) => s.type || 'normal').join(',');
}

/** Structural differences between a routine and this workout (not weights/reps). */
export function routineDiff(r: Routine, items: LiveItem[]): string[] {
  const out: string[] = [];
  const name = exerciseName;
  const rIds = r.items.map((i) => i.exerciseId);
  const wIds = items.map((i) => i.exerciseId);
  for (const it of items) if (!rIds.includes(it.exerciseId)) out.push(`נוסף ${name(it.exerciseId)} (${it.sets.length} סטים)`);
  for (const ri of r.items) if (!wIds.includes(ri.exerciseId)) out.push(`הוסר ${name(ri.exerciseId)}`);
  const keptR = rIds.filter((id) => wIds.includes(id));
  const keptW = wIds.filter((id) => rIds.includes(id));
  if (keptR.join() !== keptW.join()) out.push('סדר התרגילים השתנה');
  const sr = ss.signature(r.items), sw = ss.signature(items);
  if (keptW.some((id) => (sr[id] || '') !== (sw[id] || ''))) out.push('הסופרסטים השתנו');
  for (const it of items) {
    const ri = r.items.find((x) => x.exerciseId === it.exerciseId);
    if (!ri) continue;
    const n = name(it.exerciseId);
    if (it.sets.length !== ri.sets.length) out.push(`${n}: ${ri.sets.length} ← ${it.sets.length} סטים`);
    else if (typeSig(it.sets) !== typeSig(ri.sets)) out.push(`${n}: סוגי הסטים השתנו`);
    if ((it.restSec || 0) !== (ri.restSec || 0)) {
      out.push(`${n}: מנוחה ${ri.restSec ? fmtClock(ri.restSec) : 'כבויה'} ← ${it.restSec ? fmtClock(it.restSec) : 'כבויה'}`);
    }
    if (ri.repMin && (it.repMin !== ri.repMin || it.repMax !== ri.repMax)) {
      out.push(`${n}: חזרות ${ri.repMin}–${ri.repMax} ← ${it.repMin}–${it.repMax}`);
    }
  }
  return out;
}

function routineItemsFrom(items: LiveItem[], r: Routine): RoutineItem[] {
  return items.map((it) => {
    const ri = r.items.find((x) => x.exerciseId === it.exerciseId);
    return {
      exerciseId: it.exerciseId,
      restSec: it.restSec || 0,
      repMin: it.repMin,
      repMax: it.repMax,
      superset: it.superset || undefined,
      notes: ri ? ri.notes || '' : '',
      sets: it.sets.map((s) => ({
        type: s.type || 'normal',
        weight: s.weight === '' || s.weight == null ? '' : Number(s.weight),
        reps: s.reps === '' || s.reps == null ? '' : Number(s.reps),
      })),
    };
  });
}

export function updateRoutineFromWorkout(a: ActiveWorkout) {
  const r = a.routineId ? routine(a.routineId) : null;
  if (!r) return;
  const copy = deepClone(r);
  copy.items = routineItemsFrom(a.items, r);
  saveRoutine(copy);
}

/** Commits the live workout to history; returns the saved record. */
export function saveWorkout(a: ActiveWorkout): Workout {
  const record: Workout = {
    id: a.id,
    name: a.name,
    routineId: a.routineId,
    startedAt: a.startedAt,
    endedAt: Date.now(),
    durationSec: Math.round(elapsedSec(a)),
    notes: '',
    deload: a.adaptationDeload || deloadActive() || undefined,
    items: a.items
      .map((it) => ({
        exerciseId: it.exerciseId,
        notes: it.notes || '',
        restSec: it.restSec || 0,
        repMin: it.repMin,
        repMax: it.repMax,
        superset: it.superset || undefined,
        sets: it.sets
          .filter((s) => s.done)
          .map((s) => {
            const out: Workout['items'][number]['sets'][number] = {
              type: s.type,
              weight: Number(s.weight) || 0,
              reps: Number(s.reps) || 0,
              done: true,
            };
            if (s.effort) out.effort = s.effort;
            return out;
          }),
      }))
      .filter((it) => it.sets.length),
  };

  const prs: NonNullable<Workout['prs']> = [];
  for (const it of record.items) {
    const b = exerciseBests(it.exerciseId, a.id);
    let top1 = 0, topW = 0, vol = 0;
    for (const s of it.sets) {
      if (s.type === 'warmup') continue;
      top1 = Math.max(top1, epley1RM(s.weight, s.reps));
      topW = Math.max(topW, s.weight);
      vol += s.weight * s.reps;
    }
    const hits: string[] = [];
    if (top1 > b.e1rm + 0.01) hits.push(`1RM ${fmtNum(fmtW(top1))} ${unitLabel()}`);
    if (topW > b.weight + 0.01) hits.push(`משקל ${fmtNum(fmtW(topW))} ${unitLabel()}`);
    if (vol > b.volume + 0.01 && b.volume > 0) hits.push('נפח');
    if (hits.length) prs.push({ exerciseId: it.exerciseId, hits });
  }
  record.prs = prs;

  if (a.resumed) deleteWorkout(a.id);
  commitWorkout(record);
  endActive();
  return record;
}

// ---------------- home: goal, streak, up next ----------------

function weekCounts(): Map<number, number> {
  const m = new Map<number, number>();
  for (const w of L.workouts) {
    const k = weekStart(w.startedAt);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** Your setting, else the median of the last 8 trained weeks, 2–6. */
export function weeklyGoal(): number {
  if (L.settings.weeklyGoal) return L.settings.weeklyGoal;
  const m = weekCounts();
  const cur = weekStart(Date.now());
  const xs: number[] = [];
  for (let k = 1; k <= 8; k++) {
    const n = m.get(weekStart(cur - k * WEEK + DAY));
    if (n) xs.push(n);
  }
  if (!xs.length) return 3;
  xs.sort((a, b) => a - b);
  return clamp(xs[Math.floor(xs.length / 2)], 2, 6);
}

/** Weeks in a row hitting the goal (this week counts once it's hit). */
export function weekStreak(): number {
  const m = weekCounts();
  const goal = weeklyGoal();
  let wk = weekStart(Date.now());
  let n = 0;
  if ((m.get(wk) || 0) >= goal) n++;
  wk = weekStart(wk - WEEK + DAY);
  while ((m.get(wk) || 0) >= goal) {
    n++;
    wk = weekStart(wk - WEEK + DAY);
  }
  return n;
}

export function workoutsThisWeek(): number {
  const ws = weekStart(Date.now());
  return L.workouts.filter((w) => w.startedAt >= ws).length;
}

/** Routines are a rotation: next is the one after the routine done most recently. */
export function nextRoutine(): Routine | null {
  const list = routines().filter((r) => r.items.length);
  if (!list.length) return null;
  const last = workouts().find((w) => w.routineId && routine(w.routineId));
  if (!last) return list[0];
  const i = list.findIndex((r) => r.id === last.routineId);
  return list[(i + 1) % list.length];
}

export function lastDone(routineId: string): Workout | null {
  return workouts().find((x) => x.routineId === routineId) ?? null;
}

export function avgMinutes(routineId: string): number {
  const ws = workouts().filter((w) => w.routineId === routineId && w.durationSec > 300).slice(0, 6);
  if (!ws.length) return 0;
  return Math.round(ws.reduce((n, w) => n + w.durationSec, 0) / ws.length / 60);
}

/** What the coach has lined up for a routine. */
export function planLine(r: Routine): string {
  if (deloadActive()) return 'שבוע דילואוד — אימון קל יותר מוכן';
  let up = 0, reps = 0, first = 0;
  for (const it of r.items) {
    const ex = exercise(it.exerciseId);
    if (!ex || ex.tracking === 'cardio') continue;
    const rr = it.repMin ? { min: it.repMin, max: it.repMax! } : defaultRepRange(it.exerciseId);
    const p = progressionPlan(it.exerciseId, rr.min, rr.max);
    if (!p) {
      first++;
      continue;
    }
    if (p.counts.weight) up++;
    else if (p.counts.reps) reps++;
  }
  const bits: string[] = [];
  if (up) bits.push(`${up} כבדים יותר`);
  if (reps) bits.push(`${reps} עם יותר חזרות`);
  if (first) bits.push(`${first} חדשים`);
  return bits.length ? `יעדים מוכנים: ${bits.join(' · ')}` : '';
}

export function routineSubtitle(r: Routine): string {
  const names = r.items.map((it) => exerciseName(it.exerciseId));
  if (!names.length) return 'אין תרגילים עדיין';
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} ועוד ${names.length - 3}` : shown;
}

/** Working-set number shown in the set badge (warm-ups don't count). */
export function workingNum(sets: Array<{ type: string }>, si: number): number {
  let n = 0;
  for (let i = 0; i <= si; i++) if (sets[i].type !== 'warmup') n++;
  return n || 1;
}
