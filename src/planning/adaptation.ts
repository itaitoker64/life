import { addDays } from '../lib/dates';
import type { LiveItem } from '../strength/types';
import type { Session } from './model';
export type Area = 'legs' | 'upper' | 'core';
export interface TrainingLoad {
  id: string; date: string; title: string; minutes: number; effort: number; areas: Area[];
  replacementId?: string; routineId?: string; kind?: 'strength' | 'run' | 'crossfit';
}
export interface AdaptationContext {
  today: string; loads: TrainingLoad[]; routineAreas: Record<string, Area[]>; protectedDates: string[];
}
export interface Adjustment { key: string; originalDate: string; reason: string; mode?: 'move' | 'reduce'; factor?: number; }
export function adaptSessions(plans: Session[], context: AdaptationContext, dismissed: string[]): Session[] {
  const end = addDays(context.today, 6);
  const occupied = new Map<string, Session[]>();
  plans.forEach(p => occupied.set(p.date, [...(occupied.get(p.date) ?? []), p]));
  return plans.map(plan => {
    if (context.loads.some(l => l.date === plan.date && (l.replacementId === plan.id || !l.replacementId && l.kind === plan.kind && (!plan.routineId || l.routineId === plan.routineId)))) return plan;
    if (plan.adjustment && plan.adjustment.originalDate < context.today) return plan;
    if (plan.date < context.today || plan.date > end || plan.status === 'completed' || plan.status === 'skipped' || plan.manual || context.protectedDates.some(d => d === plan.date || d === addDays(plan.date, 1))) return plan;
    const areas = plan.kind === 'run' ? ['legs'] : context.routineAreas[plan.routineId ?? ''] ?? ['legs', 'upper', 'core'];
    const dailyLoads = new Map<string, number>();
    for (const load of context.loads) if (load.areas.some(area => areas.includes(area))) dailyLoads.set(load.date, (dailyLoads.get(load.date) ?? 0) + load.minutes * load.effort);
    const conflicts = (date: string) => context.loads.filter(l => {
      // Conservative scheduling defaults, not a measured physiological recovery prediction.
      const dailyLoad = dailyLoads.get(l.date) ?? 0;
      // Easy aerobic work can accompany controlled strength sessions; avoid treating it as intervals.
      if (plan.kind === 'run' && (plan.plannedEffort ?? 7) <= 4 && l.effort < 9 && dailyLoad < 600) return false;
      const recoveryDays = dailyLoad >= 600 ? 3 : dailyLoad >= 450 ? 2 : l.effort >= 9 || l.minutes * l.effort >= 600 ? 3 : l.effort >= 7 || l.minutes * l.effort >= 300 ? 2 : 0;
      return recoveryDays > 0 && date >= l.date && date < addDays(l.date, recoveryDays) && l.areas.some(a => areas.includes(a));
    });
    const loads = conflicts(plan.date);
    if (!loads.length) return plan;
    const key = `${plan.id}|${loads.map(l => `${l.id}:${l.date}:${l.minutes}:${l.effort}:${l.areas.join(',')}`).sort().join('|')}`;
    if (dismissed.includes(key)) return plan;
    const reason = `חפיפה בעומס עם ${loads.map(l => l.title).join(' ו־')}. הוקצה זמן התאוששות לפי משך האימון והעצימות.`;
    // Keep the weekly split intact; never pile missed work onto an already occupied day.
    for (let delta = 1; !plan.fixedDay && delta <= 2; delta++) {
      const date = addDays(plan.date, delta);
      if (date > end || conflicts(date).length || context.protectedDates.some(d => d === date || d === addDays(date, 1)) || (occupied.get(date)?.length ?? 0) > 0) continue;
      occupied.set(plan.date, (occupied.get(plan.date) ?? []).filter(p => p.id !== plan.id));
      occupied.set(date, [plan]);
      return { ...plan, date, adjustment: { key, originalDate: plan.date, reason, mode: 'move' } };
    }
    return { ...plan, adjustment: { key, originalDate: plan.date, reason: `${reason} ${plan.fixedDay ? 'זהו יום אימון קבוע: ' : 'אין יום פנוי לדחייה: '}${plan.kind === 'run' ? 'הריצה הוחלפה בריצה קלה בנפח מופחת' : plan.kind === 'crossfit' ? 'הקרוספיט הוחלף בסבב טכני קל ומקוצר, ללא תחרות או עבודה עד כשל' : 'האימון יתחיל עם פחות סטים ומשקל מופחת, ללא בדיקות כשל'}. אפשר לבחור מנוחה או להזיז ידנית.`, mode: 'reduce', factor: 0.7 } };
  });
}
let provider: (() => AdaptationContext) | undefined;
export function setAdaptationProvider(value: () => AdaptationContext) { provider = value; }
export function adaptationContext() { return provider?.(); }
export function muscleAreas(muscles: string[]): Area[] {
  const areas = new Set<Area>();
  for (const muscle of muscles) {
    if (['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Cardio'].includes(muscle)) areas.add('legs');
    else if (muscle === 'Abs') areas.add('core');
    else if (['Full Body', 'Other'].includes(muscle)) { areas.add('legs'); areas.add('upper'); areas.add('core'); }
    else areas.add('upper');
  }
  return [...areas];
}

/** Reduce today's active copy, leaving the saved routine and warm-ups intact. */
export function reducedStrengthItems(items: LiveItem[], factor: number, cardioIds: string[] = []): LiveItem[] {
  return items.map(item => {
    const working = item.sets.filter(s => s.type !== 'warmup');
    const keep = new Set(working.slice(0, Math.max(1, Math.floor(working.length * factor))));
    return { ...item, sets: item.sets.filter(s => s.type === 'warmup' || keep.has(s)).map(s => s.type === 'warmup' ? { ...s } : {
      ...s, type: 'normal', weight: typeof s.weight === 'number' ? cardioIds.includes(item.exerciseId) ? Math.round(s.weight * factor * 10) / 10 : Math.round(s.weight * 0.9 * 2) / 2 : s.weight,
    }) };
  });
}
