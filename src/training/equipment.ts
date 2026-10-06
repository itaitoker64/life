import type { Exercise, RoutineItem } from '../strength/types';
import type { HybridKind } from './combined';
export const EQUIPMENT = {
  dumbbells: 'משקולות יד', barbell: 'מוט ומשקולות', rack: 'כלוב / סטנד בטוח', bench: 'ספסל שטוח', adjustable_bench: 'ספסל מתכוונן',
  cable_low: 'פולי תחתון', cable_high: 'פולי עליון', pullup_bar: 'מתח', chest_press: 'מכונת לחיצת חזה', row_machine: 'מכונת חתירת כוח',
  leg_press: 'לחיצת רגליים', leg_extension: 'פשיטת ברכיים', seated_leg_curl: 'כפיפת ברכיים בישיבה', lying_leg_curl: 'כפיפת ברכיים בשכיבה',
  shoulder_press: 'מכונת כתפיים', smith: 'סמית׳', kettlebell: 'קטלבל', bands: 'גומיות', floor_space: 'מקום פנוי לשכיבה',
  open_space: 'מרחב להליכה / תנועה', wall: 'קיר פנוי', treadmill: 'הליכון', bike: 'אופני כושר', rower: 'חתירה אירובית', elliptical: 'אליפטיקל', dip_bars: 'מקבילים',
} as const;
export type EquipmentKey = keyof typeof EQUIPMENT;
export interface GymInventory { equipment: EquipmentKey[]; noOverhead: boolean; noJumping: boolean; noFloor: boolean; smallSpace: boolean; }
export interface TailoredRow { originalId?: string; exerciseId: string; changed: boolean; reason: string; item: RoutineItem; }
export interface WorkoutDraft {
  id: string; date: string; kind: HybridKind; title: string; sourceSessionId?: string; sourceRoutineId?: string;
  rows: TailoredRow[]; omitted: string[]; inventory: GymInventory; minutes: number; instructions: string; createdAt: number; appliedAdjustmentKey?: string;
}
export const emptyInventory = (): GymInventory => ({ equipment: [], noOverhead: false, noJumping: true, noFloor: false, smallSpace: true });
interface Capability { group: string; requirements: EquipmentKey[]; overhead?: boolean; floor?: boolean; space?: boolean; }
const cap = (group: string, requirements: EquipmentKey[], extra: Partial<Capability> = {}): Capability => ({ group, requirements, ...extra });
// An explicit allowlist prevents assuming that one visible machine means every machine exists.
const CAPABILITIES: Record<string, Capability> = {
  'Bench Press': cap('push', ['barbell','rack','bench']), 'Incline Bench Press': cap('push', ['barbell','rack','adjustable_bench']),
  'Dumbbell Bench Press': cap('push', ['dumbbells','bench']), 'Incline Dumbbell Press': cap('push', ['dumbbells','adjustable_bench']),
  'Chest Press Machine': cap('push', ['chest_press']), 'Push-Up': cap('push', ['floor_space'], { floor: true }), 'Wall Push-Up': cap('push', ['wall']), 'Dip': cap('dip', ['dip_bars']), 'Triceps Dip': cap('triceps_dip', ['dip_bars']),
  'Dumbbell Fly': cap('fly', ['dumbbells','bench']), 'Cable Fly': cap('fly', ['cable_high']), 'Cable Fly Crossover': cap('fly', ['cable_high']),
  'Barbell Row': cap('row', ['barbell']), 'Pendlay Row': cap('row', ['barbell']), 'Dumbbell Row': cap('row', ['dumbbells','bench']), 'Standing Dumbbell Row': cap('row', ['dumbbells']), 'Kettlebell Row': cap('row', ['kettlebell']), 'Band Bent-Over Row': cap('row', ['bands']),
  'Seated Cable Row': cap('row', ['cable_low']), 'Machine Row': cap('row', ['row_machine']), 'Iso-Lateral Row (Machine)': cap('row', ['row_machine']),
  'Lat Pulldown': cap('pull', ['cable_high'], { overhead: true }), 'Wide-Grip Pulldown': cap('pull', ['cable_high'], { overhead: true }), 'Pull-Up': cap('pull', ['pullup_bar'], { overhead: true }), 'Chin-Up': cap('pull', ['pullup_bar'], { overhead: true }),
  'Deadlift': cap('hinge', ['barbell']), 'Romanian Deadlift': cap('hinge', ['barbell']), 'Stiff-Leg Deadlift': cap('hinge', ['barbell']), 'Dumbbell Romanian Deadlift': cap('hinge', ['dumbbells']), 'Kettlebell Deadlift': cap('hinge', ['kettlebell']), 'Band Romanian Deadlift': cap('hinge', ['bands']),
  'Back Squat': cap('squat', ['barbell','rack']), 'Front Squat': cap('squat', ['barbell','rack']), 'Goblet Squat': cap('squat', ['dumbbells']), 'Kettlebell Goblet Squat': cap('squat', ['kettlebell']),
  'Leg Press': cap('squat', ['leg_press']), 'Smith Machine Squat': cap('squat', ['smith']), 'Bodyweight Squat': cap('squat', []),
  'Walking Lunge': cap('single_leg', ['dumbbells','open_space'], { space: true }), 'Bulgarian Split Squat': cap('single_leg', ['dumbbells','bench']), 'Bodyweight Split Squat': cap('single_leg', []),
  'Seated Leg Curl': cap('knee_flexion', ['seated_leg_curl']), 'Lying Leg Curl': cap('knee_flexion', ['lying_leg_curl'], { floor: false }), 'Leg Extension': cap('knee_extension', ['leg_extension']),
  'Hip Thrust': cap('hip_extension', ['barbell','bench']), 'Glute Bridge': cap('hip_extension', ['barbell','floor_space'], { floor: true }), 'Floor Glute Bridge': cap('hip_extension', ['floor_space'], { floor: true }),
  'Overhead Press': cap('press', ['barbell'], { overhead: true }), 'Seated Dumbbell Press': cap('press', ['dumbbells','bench'], { overhead: true }), 'Arnold Press': cap('press', ['dumbbells','bench'], { overhead: true }), 'Machine Shoulder Press': cap('press', ['shoulder_press'], { overhead: true }),
  'Lateral Raise': cap('lateral', ['dumbbells']), 'Cable Lateral Raise': cap('lateral', ['cable_low']), 'Front Raise': cap('lateral', ['dumbbells']),
  'Barbell Curl': cap('curl', ['barbell']), 'EZ-Bar Curl': cap('curl', ['barbell']), 'Dumbbell Curl': cap('curl', ['dumbbells']), 'Hammer Curl': cap('curl', ['dumbbells']),
  'Incline Dumbbell Curl': cap('curl', ['dumbbells','adjustable_bench']), 'Cable Curl': cap('curl', ['cable_low']), 'Behind-the-Back Cable Curl': cap('curl', ['cable_low']),
  'Triceps Pushdown': cap('triceps', ['cable_high']), 'Rope Pushdown': cap('triceps', ['cable_high']), 'Overhead Triceps Extension': cap('triceps', ['dumbbells'], { overhead: true }), 'Triceps Kickback': cap('triceps', ['dumbbells']),
  'Crunch': cap('core', ['floor_space'], { floor: true }), 'Cable Crunch': cap('core', ['cable_high']), 'Machine Crunch': cap('core', []),
  'Plank': cap('core', ['floor_space'], { floor: true }), 'Russian Twist': cap('core', ['floor_space'], { floor: true }),
  'Treadmill': cap('cardio', ['treadmill']), 'Stationary Bike': cap('cardio', ['bike']), 'Rowing Machine': cap('cardio', ['rower']), 'Elliptical': cap('cardio', ['elliptical']),
};
// No generic permission for unrecognised equipment; unknown custom exercises require manual choice.
export function exerciseAvailable(exercise: Exercise, gym: GymInventory): boolean {
  const c = CAPABILITIES[exercise.name];
  if (!c || exercise.isCustom || ['Machine Crunch','Cable Fly','Cable Fly Crossover'].includes(exercise.name)) return false;
  const available = new Set(gym.equipment); if (available.has('adjustable_bench')) available.add('bench');
  return c.requirements.every(e => available.has(e)) && !(c.overhead && gym.noOverhead) && !(c.floor && gym.noFloor) && !(c.space && gym.smallSpace);
}
export function substituteExercise(original: Exercise, exercises: Exercise[], gym: GymInventory, used: Set<string>): Exercise | undefined {
  const c = CAPABILITIES[original.name]; if (!c || original.isCustom) return undefined;
  if (exerciseAvailable(original, gym) && !used.has(original.id)) return original;
  return exercises.filter(e => e.tracking === original.tracking && CAPABILITIES[e.name]?.group === c.group && exerciseAvailable(e, gym) && !used.has(e.id))
    .sort((a, b) => Number(b.primary === original.primary) - Number(a.primary === original.primary) || Number(b.equipment === original.equipment) - Number(a.equipment === original.equipment) || a.id.localeCompare(b.id))[0];
}
export function tailorWorkout(source: RoutineItem[], exercises: Exercise[], gym: GymInventory, kind: HybridKind, minutes: number): Pick<WorkoutDraft, 'rows' | 'omitted' | 'instructions'> {
  const used = new Set<string>(), rows: TailoredRow[] = [], omitted: string[] = [];
  for (const item of source) {
    const original = exercises.find(e => e.id === item.exerciseId);
    if (!original) { omitted.push('תרגיל שלא נמצא בספרייה'); continue; }
    const ex = substituteExercise(original, exercises, gym, used);
    if (!ex) { omitted.push(`${original.nameHe ?? original.name}: אין חלופה מאומתת לציוד הזמין.`); continue; }
    used.add(ex.id); const changed = ex.id !== original.id;
    const work = item.sets.filter(s => s.type !== 'warmup');
    if (!work.length) { omitted.push(`${original.nameHe ?? original.name}: אין סטי עבודה בתכנון המקורי.`); continue; }
    // New exercise / unfamiliar machine: do not transfer weights from the old exercise.
    const sets = work.slice(0, kind === 'crossfit' ? 3 : undefined)
      .map(s => ({ ...s, type: 'normal' as const, weight: ex.tracking === 'cardio' ? s.weight : '' as const, reps: ex.tracking === 'cardio' ? '' as const : changed ? 10 : s.reps }));
    rows.push({ originalId: original.id, exerciseId: ex.id, changed,
      reason: ex.tracking === 'cardio' ? 'הזמן נשמר בדקות; הקצב נבחר מחדש ללא העתקת מרחק.' : changed ? 'אותה משפחת תנועה; המשקל נבחר מחדש בהתאם לציוד.' : 'התרגיל נשמר; בחרו משקל שמתאים למכשיר במקום הזה.',
      item: { ...item, exerciseId: ex.id, superset: kind === 'crossfit' ? 'spontaneous-circuit' : undefined, repMin: changed && ex.tracking !== 'cardio' ? 8 : item.repMin, repMax: changed && ex.tracking !== 'cardio' ? 12 : item.repMax, sets, notes: `${item.notes || ''}\n${ex.tracking === 'cardio' ? 'משך בדקות, קצב נשלט; לא מעתיקים יעד מרחק מהמכשיר הקודם.' : 'בחרו משקל אחרי סט חימום קל; השאירו 2–3 חזרות.'}`.trim() } });
  }
  if (kind === 'run') {
    const cardio = exercises.find(e => e.name === 'Treadmill' && exerciseAvailable(e, gym)) ?? exercises.find(e => e.tracking === 'cardio' && exerciseAvailable(e, gym));
    if (cardio) { rows.length = 0; omitted.length = 0; rows.push({ exerciseId: cardio.id, changed: cardio.name !== 'Treadmill', reason: cardio.name === 'Treadmill' ? 'ריצה קלה על הליכון במקום ריצה בחוץ.' : 'תחליף אירובי באותה עצימות; אינו נספר כקילומטרים של ריצה.', item: { exerciseId: cardio.id, restSec: 0, notes: 'קצב שמאפשר שיחה. חימום ושחרור 5 דקות.', sets: [{ type: 'normal', weight: minutes, reps: '' }] } }); }
    else { rows.length = 0; omitted.push('אין מכשיר אירובי מאומת. אפשר לבחור ריצה / הליכה בחוץ במקום ליצור תרגיל שאינו מתאים.'); }
  }
  if (kind !== 'run') {
    // Reserve a warm-up, then allocate working sets within an approximate time budget.
    const desired = new Map(rows.map(row => [row.exerciseId, row.item.sets]));
    const cost = (row: TailoredRow, index: number) => {
      const cardio = exercises.find(ex => ex.id === row.exerciseId)?.tracking === 'cardio';
      return (cardio ? Number(desired.get(row.exerciseId)![index].weight) || 2 : 1) + row.item.restSec / 60;
    };
    let remaining = Math.max(0, minutes - 8);
    for (let i = 0; i < rows.length;) {
      const row = rows[i], needed = cost(row, 0) + 1;
      if (needed > remaining) {
        const ex = exercises.find(e => e.id === row.exerciseId);
        omitted.push(`${ex?.nameHe ?? ex?.name}: לא נכנס למסגרת הזמן עם חימום ומנוחה.`);
        rows.splice(i, 1); continue;
      }
      remaining -= needed; row.item.sets = desired.get(row.exerciseId)!.slice(0, 1); i++;
    }
    let added = true;
    while (added) {
      added = false;
      for (const row of rows) {
        const next = row.item.sets.length, sets = desired.get(row.exerciseId)!;
        if (next < sets.length && cost(row, next) <= remaining) {
          remaining -= cost(row, next); row.item.sets.push(sets[next]); added = true;
        }
      }
    }
    rows.forEach(row => { if (row.item.sets.length < desired.get(row.exerciseId)!.length) row.reason += ' מספר הסטים צומצם למסגרת הזמן.'; });
  }
  return { rows, omitted, instructions: kind === 'crossfit' ? 'מסגרת הזמן כוללת חימום ומנוחות לפי הערכה; התאימו את הקצב בפועל. חימום 5–8 דקות. בצעו את הסטים כסבב בקצב נשלט, עם מנוחה לפי הצורך. אין הרמות אולימפיות, קפיצות או עבודה עד כשל. עצימות 6–7/10; סיימו מוקדם אם הטכניקה נפגעת.' : kind === 'run' ? 'שמרו את משך האימון והעצימות האירובית, גם כשהמכשיר משתנה.' : 'מסגרת הזמן כוללת חימום ומנוחות לפי הערכה. חימום 5–8 דקות וסט הכנה קל לכל תרגיל. המטרה היא לשמור על תנועות ומינון העבודה של האימון המקורי.' };
}
