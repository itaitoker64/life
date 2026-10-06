import { effectiveCoachPlans, type CombinedProgram } from '../training/combined';
import type { WorkoutDraft } from '../training/equipment';
import { adaptSessions, adaptationContext, type TrainingLoad, type Adjustment } from './adaptation';
import type { DailyTotal } from '../db/log';
import { addDays, parseISODate, toISODate } from '../lib/dates';
import type { Activity, CoachingPlan } from '../run/types';
import type { Workout } from '../strength/types';

export type TrainingKind = 'strength' | 'run' | 'crossfit';
export interface Session {
  id: string;
  date: string;
  kind: TrainingKind;
  title: string;
  routineId?: string;
  coachDate?: string;
  manual?: boolean;
  fixedDay?: boolean;
  plannedEffort?: number;
  minutes?: number;
  adjustment?: Adjustment;
  status?: 'planned' | 'completed' | 'skipped';
}
export interface WeeklyRule {
  id: string;
  weekday: number;
  kind: TrainingKind;
  title: string;
  routineId?: string;
  startDate: string;
  endDate?: string;
  fixedDay?: boolean;
  plannedEffort?: number;
  minutes?: number;
}
export interface OccurrenceOverride {
  id: string;
  originalDate: string;
  date: string;
  cancelled?: boolean;
}
export interface ReminderSettings {
  workoutEnabled: boolean;
  workoutTime: string;
  mealsEnabled: boolean;
  mealTimes: string[];
}
export interface PlanningData {
  rules: WeeklyRule[];
  sessions: Session[];
  overrides: OccurrenceOverride[];
  reminders: ReminderSettings;
  alternateWorkouts?: TrainingLoad[];
  dismissedAdjustments?: string[];
  adaptationEnabled?: boolean;
  combinedProgram?: CombinedProgram;
  programHistory?: CombinedProgram[];
  workoutDrafts?: WorkoutDraft[];
  automaticAdjustments?: Array<{ id: string; date: string; adjustment: Adjustment }>;
}
export const emptyPlanning = (): PlanningData => ({
  rules: [], sessions: [], overrides: [], alternateWorkouts: [], dismissedAdjustments: [], adaptationEnabled: true,
  reminders: { workoutEnabled: false, workoutTime: '18:00', mealsEnabled: false, mealTimes: ['08:00', '13:00', '20:00'] },
});
export const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && toISODate(parseISODate(date)) === date;
export const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

/** Occurrence IDs remain stable when an individual workout is moved. */
export function plannedSessions(data: PlanningData, coachPlans: CoachingPlan[], from: string, to: string): Session[] {
  const context = adaptationContext();
  const requestedFrom = from, requestedTo = to;
  if (context && data.adaptationEnabled !== false) {
    if (from > context.today) from = context.today;
    if (to < addDays(context.today, 8)) to = addDays(context.today, 8);
  }
  const replacements = new Set((data.alternateWorkouts ?? []).map(w => w.replacementId).filter(Boolean));
  const overrides = new Map(data.overrides.map(o => [o.id, o]));
  const apply = (s: Session): Session[] => {
    const override = overrides.get(s.id);
    if (override?.cancelled) return [];
    if (replacements.has(s.id)) s = { ...s, status: 'completed' };
    const pastAdjustment = !override && context && data.adaptationEnabled !== false ? data.automaticAdjustments?.find(a => a.id === s.id && a.adjustment.originalDate < context.today && !(data.dismissedAdjustments ?? []).includes(a.adjustment.key)) : undefined;
    const date = override?.date ?? pastAdjustment?.date ?? s.date;
    if (pastAdjustment) s = { ...s, adjustment: pastAdjustment.adjustment };
    return date >= from && date <= to ? [{ ...s, date, manual: !!override }] : [];
  };
  const coach = effectiveCoachPlans(data.combinedProgram, data.programHistory, coachPlans, from, to, data.overrides.filter(o => o.id.startsWith('coach:')).map(o => o.originalDate), data.overrides.map(o => o.id)).filter(p => p.workout_type !== 'rest').map(p => ({
    id: `coach:${p.id}`, date: p.plan_date, coachDate: p.plan_date,
    kind: 'run' as const, title: p.title, status: p.status, minutes: p.duration_min ?? undefined, // A long run is long but at conversation pace: aerobic effort, not a hard session.
    plannedEffort: ['easy', 'recovery', 'long'].includes(p.workout_type) ? 4 : 7,
  }));
  // The coach's detailed session replaces a generic recurring run for that day.
  const coachDates = new Set(coach.flatMap(s => overrides.get(s.id)?.cancelled ? [] : [s.date, overrides.get(s.id)?.date ?? s.date]));
  const result = [...data.sessions.flatMap(apply), ...coach.flatMap(apply)];
  for (const rule of data.rules) {
    const dates = new Set<string>();
    for (let d = from; d <= to; d = addDays(d, 1)) dates.add(d);
    for (const o of data.overrides) if (o.id === `weekly:${rule.id}:${o.originalDate}`) dates.add(o.originalDate);
    for (const a of data.automaticAdjustments ?? []) if (a.id === `weekly:${rule.id}:${a.adjustment.originalDate}`) dates.add(a.adjustment.originalDate);
    for (const date of dates) {
      if (date < rule.startDate || (rule.endDate && date > rule.endDate) || parseISODate(date).getDay() !== rule.weekday) continue;
      if (rule.kind === 'run' && coachDates.has(date)) continue;
      result.push(...apply({ id: `weekly:${rule.id}:${date}`, date, kind: rule.kind, title: rule.title, routineId: rule.routineId, fixedDay: rule.fixedDay ?? rule.kind === 'crossfit', plannedEffort: rule.plannedEffort, minutes: rule.minutes }));
    }
  }
  const adapted = context && data.adaptationEnabled !== false ? adaptSessions(result, { ...context, loads: [...context.loads, ...(data.alternateWorkouts ?? []).filter(w => !context.loads.some(l => l.id === w.id))] }, data.dismissedAdjustments ?? []) : result;
  return adapted.filter(s => s.date >= requestedFrom && s.date <= requestedTo).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export interface CompletedSession {
  id: string;
  date: string;
  kind: TrainingKind;
  title: string;
  routineId?: string;
  workoutId?: string;
  replacementId?: string;
  km: number;
  minutes: number;
}
export function completedSessions(workouts: Workout[], activities: Activity[], data?: PlanningData): CompletedSession[] {
  return [
    ...(data?.alternateWorkouts ?? []).filter(w => !workouts.some(a => `lift:${a.id}` === w.id) && !activities.some(a => `activity:${a.id}` === w.id)).map(w => ({ id: w.id, date: w.date, kind: w.kind ?? (/wod|קרוספיט/i.test(w.title) ? 'crossfit' as const : 'strength' as const), title: w.title, replacementId: w.replacementId, km: 0, minutes: w.minutes })),
    // A partial workout is an extra session: its replacement id matches no plan, so the plan stays open.
    ...workouts.map(w => ({ id: `lift:${w.id}`, workoutId: w.id, date: toISODate(new Date(w.startedAt)), kind: w.trainingKind ?? 'strength' as const, title: w.name, replacementId: w.partial ? `partial:${w.id}` : w.plannedSessionId ?? data?.alternateWorkouts?.find(a => a.id === `lift:${w.id}`)?.replacementId, routineId: w.partial ? undefined : w.routineId ?? undefined, km: 0, minutes: (w.durationSec ?? 0) / 60 })),
    ...activities.map(a => ({ id: `activity:${a.id}`, date: toISODate(new Date(a.start_time)), kind: 'run' as const, title: a.name ?? 'ריצה', replacementId: data?.alternateWorkouts?.find(w => w.id === `activity:${a.id}`)?.replacementId, km: a.distance_m / 1000, minutes: (a.duration_s ?? 0) / 60 })),
  ];
}

/** One actual session can satisfy at most one plan; exact routine matches win. */
export function matchSessions(plans: Session[], actual: CompletedSession[]) {
  const matches = new Map<string, string>();
  const used = new Set<string>();
  const ordered = [...plans].sort((a, b) =>
    Number(!!b.routineId) - Number(!!a.routineId)
    || Number(b.status === 'completed') - Number(a.status === 'completed')
    || Number(!!b.coachDate) - Number(!!a.coachDate));
  for (const plan of ordered) {
    if (plan.status === 'skipped') continue;
    const found = actual.find(a => !used.has(a.id) && a.date === plan.date && (a.replacementId === plan.id || !a.replacementId && a.kind === plan.kind && (!plan.routineId || plan.routineId === a.routineId)));
    if (found) { matches.set(plan.id, found.id); used.add(found.id); }
    else if (plan.status === 'completed') matches.set(plan.id, `marked:${plan.id}`);
  }
  return matches;
}

export function summarizePeriod(plans: Session[], actual: CompletedSession[], totals: DailyTotal[], from: string, to: string, asOf: string, targets: { kcal: number; protein: number }) {
  const inRange = (date: string) => date >= from && date <= to;
  const periodPlans = plans.filter(p => inRange(p.date));
  const periodActual = actual.filter(a => inRange(a.date) && a.date <= asOf);
  const matches = matchSessions(periodPlans.filter(p => p.date <= asOf), periodActual);
  const matchedIds = new Set(matches.values());
  const logged = totals.filter(t => inRange(t.date) && t.date <= asOf);
  let elapsedDays = 0;
  for (let d = from; d <= to && d <= asOf; d = addDays(d, 1)) elapsedDays++;
  return {
    planned: periodPlans.length,
    matched: matches.size,
    completed: periodActual.length + [...matchedIds].filter(id => id.startsWith('marked:')).length,
    strength: periodActual.filter(a => a.kind === 'strength').length,
    crossfit: periodActual.filter(a => a.kind === 'crossfit').length,
    runs: periodActual.filter(a => a.kind === 'run').length,
    km: periodActual.reduce((n, a) => n + a.km, 0),
    extra: periodActual.filter(a => !matchedIds.has(a.id)).length,
    elapsedDays,
    loggedDays: logged.length,
    calorieDays: logged.filter(t => targets.kcal > 0 && Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.1).length,
    proteinDays: logged.filter(t => targets.protein > 0 && t.protein >= targets.protein).length,
  };
}
