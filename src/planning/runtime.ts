import { today, toISODate } from '../lib/dates';
import { L } from '../strength/store';
import { R } from '../run/store';
import { setAdaptationProvider, muscleAreas, type TrainingLoad } from './adaptation';
import { plannedSessions } from './model';
import { addDays } from '../lib/dates';
import { updatePlanning, usePlanning } from './store';
setAdaptationProvider(() => {
  const manual = new Set((usePlanning.getState().data.alternateWorkouts ?? []).map(w => w.id));
  const loads: TrainingLoad[] = [
    ...L.workouts.filter(w => !manual.has(`lift:${w.id}`)).map(w => {
      const sets = w.items.flatMap(i => i.sets).filter(s => s.type !== 'warmup');
      return { id: `lift:${w.id}`, date: toISODate(new Date(w.startedAt)), title: w.name,
        kind: 'strength' as const, routineId: w.routineId ?? undefined, minutes: w.durationSec / 60, effort: sets.some(s => s.effort === 'fail') || sets.length >= 18 ? 8 : 6,
        areas: muscleAreas(w.items.filter(i => i.sets.some(s => s.type !== 'warmup')).flatMap(i => { const ex = L.exercises.find(e => e.id === i.exerciseId); return ex ? [ex.primary, ...(ex.secondary ?? [])] : ['Other']; })) };
    }),
    ...R.activities.filter(a => !manual.has(`activity:${a.id}`)).map(a => ({ id: `activity:${a.id}`, date: toISODate(new Date(a.start_time)), title: a.name ?? 'ריצה', kind: 'run' as const, minutes: a.duration_s / 60,
      effort: a.duration_s >= 3600 || (a.training_load ?? 0) >= 70 ? 7 : 6, areas: ['legs' as const] })),
  ];
  const feedback = (usePlanning.getState().data.alternateWorkouts ?? []).map(w => { const lift = L.workouts.find(a => `lift:${a.id}` === w.id); const run = R.activities.find(a => `activity:${a.id}` === w.id); return { ...w, kind: lift ? 'strength' as const : run ? 'run' as const : undefined, routineId: lift?.routineId ?? undefined }; });
  return { today: today(), loads: [...loads, ...feedback], routineAreas: Object.fromEntries(L.routines.map(r => [r.id, muscleAreas(r.items.flatMap(i => { const ex = L.exercises.find(e => e.id === i.exerciseId); return ex ? [ex.primary, ...(ex.secondary ?? [])] : ['Other']; }))])),
    protectedDates: [...R.races.map(r => r.race_date), ...R.plans.filter(p => p.workout_type === 'race').map(p => p.plan_date)] };
});

/** Freeze past decisions so crossing midnight cannot rewrite training history. */
export async function syncAdaptations() {
  if (!usePlanning.getState().ready) return;
  await updatePlanning(data => {
    if (data.adaptationEnabled === false) return data;
    const now = today();
    const previous = data.automaticAdjustments ?? [];
    const historic = previous.filter(a => a.adjustment.originalDate < now);
    const upcoming = plannedSessions(data, R.plans, now, addDays(now, 8))
      .filter(s => s.adjustment && s.adjustment.originalDate >= now )
      .map(s => ({ id: s.id, date: s.date, adjustment: s.adjustment! }));
    const automaticAdjustments = [...historic, ...upcoming].sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(previous) === JSON.stringify(automaticAdjustments) ? data : { ...data, automaticAdjustments };
  });
}
