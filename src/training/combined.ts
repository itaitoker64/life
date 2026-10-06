import { addDays, parseISODate } from '../lib/dates';
import type { CoachingPlan } from '../run/types';
import type { RoutineItem, Exercise } from '../strength/types';
export type HybridKind = 'strength' | 'run' | 'crossfit';
export interface CombinedProgram {
  enabled: boolean; startDate: string; level: 'returning' | 'regular' | 'advanced';
  slots: Array<HybridKind | 'rest'>; routineIds: string[]; crossfitRoutineId?: string;
}
export const DEFAULT_SLOTS: CombinedProgram['slots'] = ['strength', 'run', 'crossfit', 'rest', 'strength', 'run', 'rest'];
// Experienced lifter: lower / upper / full body, a quality run after lower day and a longer easy run.
export const ADVANCED_SLOTS: CombinedProgram['slots'] = ['strength', 'run', 'strength', 'rest', 'strength', 'run', 'rest'];
export const KIND_LABEL: Record<HybridKind, string> = { strength: 'כוח', run: 'ריצה', crossfit: 'קרוספיט' };
export function programKind(program: CombinedProgram | undefined, date: string) {
  return program?.enabled && date >= program.startDate ? program.slots[parseISODate(date).getDay()] ?? 'rest' : null;
}
/** Run coaching supplies pace estimates; the shared split supplies frequency and intensity. */
export function combinedRunPlan(program: CombinedProgram | undefined, plan: CoachingPlan, history: CombinedProgram[] = []): CoachingPlan {
  const selected = [program, ...history].filter((p): p is CombinedProgram => !!p && p.startDate <= plan.plan_date).sort((a,b) => b.startDate.localeCompare(a.startDate))[0];
  program = selected;
  const kind = programKind(program, plan.plan_date);
  if (!kind || plan.workout_type === 'race') return plan;
  if (kind !== 'run') return { ...plan, workout_type: 'rest', title: 'מנוחה מריצה · תוכנית משולבת', description: 'האימון היומי מופיע ביומן המשולב.', duration_min: 0, distance_km: 0 };
  // Experienced: keep the running engine's prescription (VDOT paces, quality day, long run, ACWR
  // safety); only fill run days the engine left empty with a steady 40-minute run.
  if (program!.level === 'advanced') {
    if (plan.workout_type !== 'rest') return plan;
    return { ...plan, workout_type: 'easy', title: 'ריצה קלה · 40 דקות', duration_min: 40, distance_km: null, hr_zone: 2,
      description: '10 דקות קלות · 25 דקות בקצב שיחה · 5 דקות שחרור + 4 האצות של 20 שנ׳.',
      rationale: 'יום ריצה בתוכנית המשולבת. אחרי סנכרון ריצות התוכנית תקבע מרחק וקצב לפי הכושר שלך.', adjustment_sec: 0 };
  }
  const returning = program!.level === 'returning';
  const duration = returning ? 25 : 35;
  // Never re-use a threshold/interval pace as an easy pace.
  const easy = ['easy', 'recovery', 'long'].includes(plan.workout_type);
  return { ...plan, workout_type: 'easy', title: returning ? 'ריצה / הליכה קלה · 25 דקות' : 'ריצה קלה · 35 דקות',
    duration_min: duration, distance_km: null, hr_zone: 2,
    target_pace_fast_sec_km: easy ? plan.target_pace_fast_sec_km : null,
    target_pace_slow_sec_km: easy ? plan.target_pace_slow_sec_km : null,
    description: returning ? '5 דקות הליכה לחימום, 15 דקות לסירוגין: דקה ריצה קלה ושתי דקות הליכה, 5 דקות הליכה לשחרור. אפשר ללכת את כל האימון.' : '5 דקות קלות, 25 דקות ריצה בקצב שמאפשר משפטים מלאים, 5 דקות קלות. עצימות מורגשת 3–4 מתוך 10.',
    rationale: 'נפח אירובי שאפשר להתמיד בו לצד שני אימוני כוח וקרוספיט. הקרוספיט הוא היום העצימתי; לא נוספו ריצות איכות.', adjustment_sec: 0 };
}
export function validateProgram(program: CombinedProgram): string[] {
  const errors: string[] = [];
  if (program.slots.length !== 7) return ['נדרשת חלוקה של שבעה ימים.'];
  const count = (kind: string) => program.slots.filter(s => s === kind).length;
  if (count('strength') < 2) errors.push('לשמירת שריר בזמן ירידה במשקל, השאירו לפחות שני אימוני כוח.');
  if (!count('run')) errors.push('בחרו לפחות יום ריצה אחד.');
  if (!count('crossfit') && program.level !== 'advanced') errors.push('בחרו לפחות יום קרוספיט אחד.');
  if (!count('rest')) errors.push('השאירו לפחות יום מנוחה אחד.');
  if (count('crossfit') > 2) errors.push('בתוכנית הזאת מוגדרים לכל היותר שני ימי קרוספיט עצימים.');
  for (let d = 0; d < 7; d++) {
    const next = (d + 1) % 7;
    if (['strength', 'crossfit'].includes(program.slots[d]) && ['strength', 'crossfit'].includes(program.slots[next])) {
      errors.push('הפרידו בין כוח וקרוספיט באמצעות יום קל או יום מנוחה, כולל בין שבת לראשון.'); break;
    }
  }
  return errors;
}
/** Templates use blank weights, never the arbitrary weights bundled with another routine. */
export function fullBodyItems(exercises: Exercise[], variant: number, level: CombinedProgram['level']): RoutineItem[] {
  const names = variant === 0 ? ['Leg Press', 'Dumbbell Bench Press', 'Lat Pulldown', 'Romanian Deadlift', 'Crunch'] : ['Goblet Squat', 'Chest Press Machine', 'Seated Cable Row', 'Seated Leg Curl', 'Crunch'];
  return names.flatMap(name => {
    const ex = exercises.find(e => e.name === name); if (!ex) return [];
    const sets = level === 'returning' || ex.primary === 'Abs' ? 2 : 3;
    return [{ exerciseId: ex.id, restSec: ex.primary === 'Abs' ? 60 : 120, repMin: 8, repMax: 12,
      notes: 'עצימות 6–7 מתוך 10; סיימו כשנשארות 2–3 חזרות. בחרו משקל מתאים אחרי חימום.',
      sets: Array.from({ length: sets }, () => ({ type: 'normal' as const, weight: '' as const, reps: 10 })) }];
  });
}
export const RESEARCH = [
  { title: 'אירובי והפחתת שומן · 116 ניסויים', url: 'https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2828487' },
  { title: 'אימוני כוח ושמירת שריר בזמן ירידה במשקל', url: 'https://bmjopensem.bmj.com/content/11/3/e002363' },
  { title: 'עצימות גבוהה אינה בהכרח עדיפה להפחתת שומן', url: 'https://pubmed.ncbi.nlm.nih.gov/37927356/' },
  { title: 'שילוב כוח ואירובי', url: 'https://pubmed.ncbi.nlm.nih.gov/34757594/' },
];

export function effectiveCoachPlans(program: CombinedProgram | undefined, history: CombinedProgram[] | undefined, baseline: CoachingPlan[], from: string, to: string, extraDates: string[] = [], manualIds: string[] = []): CoachingPlan[] {
  const plans = new Map(baseline.map(p => [p.plan_date, p]));
  const dates = new Set(extraDates);
  for (let date = from; date <= to; date = addDays(date, 1)) dates.add(date);
  for (const date of dates) {
    if (plans.has(date)) continue;
    const empty: CoachingPlan = { id: date, plan_date: date, workout_type: 'rest', title: 'מנוחה', description: null, duration_min: 0, distance_km: 0, target_pace_fast_sec_km: null, target_pace_slow_sec_km: null, hr_zone: null, rationale: '', adaptation_note: null, adjustment_sec: 0, status: 'planned' };
    const effective = combinedRunPlan(program, empty, history);
    if (effective.workout_type !== 'rest') plans.set(date, empty);
  }
  return [...plans.values()].map(p => manualIds.includes(`coach:${p.id}`) && p.workout_type !== 'rest' ? p : combinedRunPlan(program, p, history));
}

export function crossfitItems(exercises: Exercise[], level: CombinedProgram['level']): RoutineItem[] {
  return ['Goblet Squat', 'Push-Up', 'Dumbbell Row', 'Stationary Bike'].flatMap(name => {
    const ex = exercises.find(e => e.name === name); if (!ex) return [];
    return [{ exerciseId: ex.id, superset: 'hybrid-circuit', restSec: 60, notes: 'סבב טכני; קצב נשלט, מנוחה לפי הצורך. אין עבודה עד כשל.',
      sets: Array.from({ length: level === 'returning' ? 2 : 3 }, () => ({ type: 'normal' as const, weight: ex.tracking === 'cardio' ? 2 : '' as const, reps: ex.tracking === 'cardio' ? '' as const : 10 })) }];
  });
}

type Rx = [name: string, sets: number, repMin: number, repMax: number, rest: number];
// Experienced lifter in a deficit: heavy compounds keep strength (and muscle) while calories are low;
// ~12–16 hard sets per muscle per week across three sessions (Schoenfeld 2017; Pelland 2024).
const ADVANCED_DAYS: Array<{ name: string; rx: Rx[] }> = [
  { name: 'תחתון · כוח', rx: [
    ['Back Squat', 4, 5, 8, 180], ['Romanian Deadlift', 3, 6, 10, 150], ['Bulgarian Split Squat', 3, 8, 12, 120],
    ['Seated Leg Curl', 3, 10, 15, 90], ['Standing Calf Raise', 3, 10, 15, 60], ['Hanging Leg Raise', 3, 10, 15, 60]] },
  { name: 'עליון · כוח', rx: [
    ['Bench Press', 4, 5, 8, 180], ['Barbell Row', 4, 6, 10, 150], ['Overhead Press', 3, 6, 10, 150],
    ['Lat Pulldown', 3, 8, 12, 120], ['Lateral Raise', 3, 12, 20, 60], ['Triceps Pushdown', 2, 10, 15, 60], ['Dumbbell Curl', 2, 10, 15, 60]] },
  { name: 'גוף מלא · נפח', rx: [
    ['Deadlift', 3, 4, 6, 180], ['Incline Dumbbell Press', 3, 8, 12, 120], ['Pull-Up', 3, 6, 10, 150],
    ['Leg Press', 3, 10, 15, 120], ['Cable Fly', 3, 12, 15, 60], ['Face Pull', 3, 12, 20, 60], ['Cable Crunch', 3, 10, 15, 60]] },
];
export const ADVANCED_DAY_NAMES = ADVANCED_DAYS.map((d) => d.name);
/** Weekly order of ADVANCED_DAYS on the strength slots: upper (Sun), lower (Tue), full (Thu) —
 *  a fresh leg day never sits right before the quality run. */
export const ADVANCED_ORDER = [1, 0, 2];
/** Blank weights: the first session finds working weights, then the progression coach takes over. */
export function advancedItems(exercises: Exercise[], variant: number): RoutineItem[] {
  return ADVANCED_DAYS[variant % ADVANCED_DAYS.length].rx.flatMap(([name, sets, repMin, repMax, rest]) => {
    const ex = exercises.find((e) => e.name === name); if (!ex) return [];
    return [{ exerciseId: ex.id, restSec: rest, repMin, repMax,
      notes: repMax <= 8 ? 'תרגיל מרכזי: 1–2 חזרות ברזרבה. בגירעון קלורי שומרים על המשקל — זה מה ששומר על הכוח.' : '1–2 חזרות ברזרבה; הסט האחרון יכול להגיע קרוב לכשל.',
      sets: Array.from({ length: sets }, () => ({ type: 'normal' as const, weight: '' as const, reps: repMin })) }];
  });
}
