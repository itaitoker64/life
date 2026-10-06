// Built-in exercise library, ported from lift/js/seed.js. Ids are Lift's stable slugs, so
// imported Lift history keeps pointing at the same exercises.
import { EXERCISE_IMAGES } from './images';
import type { Exercise, Routine, RoutineItem, SetType } from './types';

export const MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Traps',
  'Full Body', 'Cardio', 'Other',
];

export const MUSCLE_HE: Record<string, string> = {
  Chest: 'חזה',
  Back: 'גב',
  Shoulders: 'כתפיים',
  Biceps: 'יד קדמית',
  Triceps: 'יד אחורית',
  Forearms: 'אמות',
  Quadriceps: 'ארבע ראשי',
  Hamstrings: 'המסטרינג',
  Glutes: 'ישבן',
  Calves: 'שוקיים',
  Abs: 'בטן',
  Traps: 'טרפז',
  'Full Body': 'כל הגוף',
  Cardio: 'אירובי',
  Other: 'אחר',
};

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other'];

export const EQUIPMENT_HE: Record<string, string> = {
  Barbell: 'מוט',
  Dumbbell: 'משקולות יד',
  Machine: 'מכונה',
  Cable: 'כבל',
  Bodyweight: 'משקל גוף',
  Kettlebell: 'קטלבל',
  Band: 'גומייה',
  Other: 'אחר',
};

export const muscleHe = (m: string) => MUSCLE_HE[m] ?? m;
export const equipmentHe = (e: string) => EQUIPMENT_HE[e] ?? e;

// Weekly hard-set targets per muscle, counted fractionally (Pelland et al. 2024).
export const MUSCLE_TARGETS: Record<string, { min: number; max: number }> = {
  Chest: { min: 8, max: 18 },
  Back: { min: 10, max: 20 },
  Shoulders: { min: 8, max: 16 },
  Biceps: { min: 6, max: 14 },
  Triceps: { min: 6, max: 12 },
  Quadriceps: { min: 8, max: 18 },
  Hamstrings: { min: 6, max: 14 },
  Glutes: { min: 4, max: 12 },
  Calves: { min: 8, max: 16 },
  Abs: { min: 4, max: 16 },
};
export const OTHER_MUSCLE_TARGET = { min: 4, max: 12 };
export const GROWTH_MUSCLES = Object.keys(MUSCLE_TARGETS);
export const muscleTarget = (m: string) => MUSCLE_TARGETS[m] ?? OTHER_MUSCLE_TARGET;
export const DEFAULT_REP_RANGE = { min: 8, max: 12 };

// [English name, primary, equipment, Hebrew name, pinned id?]
const RAW: Array<[string, string, string, string, string?]> = [
  ['Bench Press', 'Chest', 'Barbell', 'לחיצת חזה במוט'],
  ['Incline Bench Press', 'Chest', 'Barbell', 'לחיצת חזה בשיפוע חיובי'],
  ['Decline Bench Press', 'Chest', 'Barbell', 'לחיצת חזה בשיפוע שלילי'],
  ['Dumbbell Bench Press', 'Chest', 'Dumbbell', 'לחיצת חזה במשקולות'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbell', 'לחיצת חזה בשיפוע במשקולות'],
  ['Dumbbell Fly', 'Chest', 'Dumbbell', 'פרפר במשקולות'],
  ['Cable Fly', 'Chest', 'Cable', 'פרפר בכבלים'],
  ['Chest Press Machine', 'Chest', 'Machine', 'לחיצת חזה במכונה'],
  ['Butterfly (Pec Deck)', 'Chest', 'Machine', 'פרפר במכונה (פק דק)', 'ex_pec_deck'],
  ['Cable Fly Crossover', 'Chest', 'Cable', 'קרוס אובר'],
  ['Push-Up', 'Chest', 'Bodyweight', 'שכיבות סמיכה'],
  ['Dip', 'Chest', 'Bodyweight', 'מקבילים'],

  ['Deadlift', 'Back', 'Barbell', 'דדליפט'],
  ['Barbell Row', 'Back', 'Barbell', 'חתירה במוט'],
  ['Pendlay Row', 'Back', 'Barbell', 'חתירת פנדליי'],
  ['T-Bar Row', 'Back', 'Machine', 'חתירת T'],
  ['Dumbbell Row', 'Back', 'Dumbbell', 'חתירה במשקולת'],
  ['Seated Cable Row', 'Back', 'Cable', 'חתירה בישיבה בכבל'],
  ['Lat Pulldown', 'Back', 'Cable', 'פולי עליון'],
  ['Wide-Grip Pulldown', 'Back', 'Cable', 'פולי עליון אחיזה רחבה'],
  ['Straight-Arm Pulldown', 'Back', 'Cable', 'פולי ידיים ישרות'],
  ['Pull-Up', 'Back', 'Bodyweight', 'מתח'],
  ['Chin-Up', 'Back', 'Bodyweight', 'מתח אחיזה הפוכה'],
  ['Machine Row', 'Back', 'Machine', 'חתירה במכונה'],
  ['Iso-Lateral Row (Machine)', 'Back', 'Machine', 'חתירה איזו-לטרלית במכונה'],
  ['Rack Pull', 'Back', 'Barbell', 'ראק פול'],
  ['Back Extension', 'Back', 'Bodyweight', 'פשיטת גב'],

  ['Overhead Press', 'Shoulders', 'Barbell', 'לחיצת כתפיים במוט'],
  ['Seated Dumbbell Press', 'Shoulders', 'Dumbbell', 'לחיצת כתפיים בישיבה'],
  ['Arnold Press', 'Shoulders', 'Dumbbell', 'לחיצת ארנולד'],
  ['Lateral Raise', 'Shoulders', 'Dumbbell', 'הרחקת כתפיים'],
  ['Cable Lateral Raise', 'Shoulders', 'Cable', 'הרחקת כתף בכבל'],
  ['Front Raise', 'Shoulders', 'Dumbbell', 'הרמה קדמית'],
  ['Reverse Fly', 'Shoulders', 'Dumbbell', 'פרפר הפוך'],
  ['Face Pull', 'Shoulders', 'Cable', 'פייס פול'],
  ['Machine Shoulder Press', 'Shoulders', 'Machine', 'לחיצת כתפיים במכונה'],
  ['Upright Row', 'Shoulders', 'Barbell', 'חתירה לסנטר'],

  ['Barbell Shrug', 'Traps', 'Barbell', 'משיכת כתפיים במוט'],
  ['Dumbbell Shrug', 'Traps', 'Dumbbell', 'משיכת כתפיים במשקולות'],

  ['Barbell Curl', 'Biceps', 'Barbell', 'כפיפת מרפקים במוט'],
  ['EZ-Bar Curl', 'Biceps', 'Barbell', 'כפיפת מרפקים במוט EZ'],
  ['Dumbbell Curl', 'Biceps', 'Dumbbell', 'כפיפת מרפקים במשקולות'],
  ['Hammer Curl', 'Biceps', 'Dumbbell', 'כפיפת פטישים'],
  ['Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 'כפיפה בספסל משופע'],
  ['Preacher Curl', 'Biceps', 'Machine', 'כפיפה בספסל כומר'],
  ['Cable Curl', 'Biceps', 'Cable', 'כפיפת מרפקים בכבל'],
  ['Concentration Curl', 'Biceps', 'Dumbbell', 'כפיפה מרוכזת'],
  ['Behind-the-Back Cable Curl', 'Biceps', 'Cable', 'כפיפה בכבל מאחורי הגב'],

  ['Close-Grip Bench Press', 'Triceps', 'Barbell', 'לחיצה באחיזה צרה'],
  ['Triceps Pushdown', 'Triceps', 'Cable', 'פשיטת מרפקים בפולי'],
  ['Rope Pushdown', 'Triceps', 'Cable', 'פשיטה בחבל'],
  ['Overhead Triceps Extension', 'Triceps', 'Dumbbell', 'פשיטת מרפקים מעל הראש'],
  ['Skull Crusher', 'Triceps', 'Barbell', 'פשיטה צרפתית'],
  ['Triceps Dip', 'Triceps', 'Bodyweight', 'מקבילים ליד אחורית'],
  ['Triceps Kickback', 'Triceps', 'Dumbbell', 'פשיטה לאחור (קיקבק)'],

  ['Wrist Curl', 'Forearms', 'Barbell', 'כפיפת שורש כף יד'],
  ['Reverse Wrist Curl', 'Forearms', 'Barbell', 'פשיטת שורש כף יד'],
  ['Farmer’s Carry', 'Forearms', 'Dumbbell', 'הליכת חקלאי'],

  ['Back Squat', 'Quadriceps', 'Barbell', 'סקוואט'],
  ['Front Squat', 'Quadriceps', 'Barbell', 'סקוואט קדמי'],
  ['Hack Squat', 'Quadriceps', 'Machine', 'האק סקוואט'],
  ['Leg Press', 'Quadriceps', 'Machine', 'לחיצת רגליים'],
  ['Leg Extension', 'Quadriceps', 'Machine', 'פשיטת ברכיים'],
  ['Bulgarian Split Squat', 'Quadriceps', 'Dumbbell', 'סקוואט בולגרי'],
  ['Walking Lunge', 'Quadriceps', 'Dumbbell', 'מכרעים בהליכה'],
  ['Goblet Squat', 'Quadriceps', 'Dumbbell', 'גובלט סקוואט'],
  ['Smith Machine Squat', 'Quadriceps', 'Machine', 'סקוואט בסמית׳'],

  ['Romanian Deadlift', 'Hamstrings', 'Barbell', 'דדליפט רומני'],
  ['Stiff-Leg Deadlift', 'Hamstrings', 'Barbell', 'דדליפט רגליים ישרות'],
  ['Lying Leg Curl', 'Hamstrings', 'Machine', 'כפיפת ברכיים בשכיבה'],
  ['Seated Leg Curl', 'Hamstrings', 'Machine', 'כפיפת ברכיים בישיבה'],
  ['Nordic Curl', 'Hamstrings', 'Bodyweight', 'נורדיק'],
  ['Good Morning', 'Hamstrings', 'Barbell', 'גוד מורנינג'],

  ['Hip Thrust', 'Glutes', 'Barbell', 'היפ תראסט'],
  ['Glute Bridge', 'Glutes', 'Barbell', 'גשר ישבן'],
  ['Cable Kickback', 'Glutes', 'Cable', 'בעיטה לאחור בכבל'],
  ['Abduction Machine', 'Glutes', 'Machine', 'מכונת הרחקה'],
  ['Sumo Deadlift', 'Glutes', 'Barbell', 'דדליפט סומו'],

  ['Standing Calf Raise', 'Calves', 'Machine', 'הרמות עקב בעמידה'],
  ['Seated Calf Raise', 'Calves', 'Machine', 'הרמות עקב בישיבה'],
  ['Leg Press Calf Raise', 'Calves', 'Machine', 'הרמות עקב במכונת רגליים'],

  ['Hanging Leg Raise', 'Abs', 'Bodyweight', 'הרמות רגליים בתלייה'],
  ['Cable Crunch', 'Abs', 'Cable', 'כפיפות בטן בכבל'],
  ['Crunch', 'Abs', 'Bodyweight', 'כפיפות בטן'],
  ['Machine Crunch', 'Abs', 'Machine', 'כפיפות בטן במכונה'],
  ['Plank', 'Abs', 'Bodyweight', 'פלאנק'],
  ['Ab Wheel Rollout', 'Abs', 'Other', 'גלגלת בטן'],
  ['Russian Twist', 'Abs', 'Bodyweight', 'פיתול רוסי'],
  ['Decline Sit-Up', 'Abs', 'Bodyweight', 'בטן בספסל שלילי'],

  ['Clean and Jerk', 'Full Body', 'Barbell', 'קלין אנד ג׳רק'],
  ['Power Clean', 'Full Body', 'Barbell', 'פאוור קלין'],
  ['Snatch', 'Full Body', 'Barbell', 'סנאץ׳'],
  ['Kettlebell Swing', 'Full Body', 'Kettlebell', 'סווינג קטלבל'],
  ['Burpee', 'Full Body', 'Bodyweight', 'ברפי'],
  ['Treadmill', 'Cardio', 'Machine', 'הליכון'],
  ['Stationary Bike', 'Cardio', 'Machine', 'אופני כושר'],
  ['Rowing Machine', 'Cardio', 'Machine', 'מכונת חתירה'],
  ['Elliptical', 'Cardio', 'Machine', 'אליפטיקל'],
  ['Stair Climber', 'Cardio', 'Machine', 'מדרגות'],
  ['Standing Dumbbell Row', 'Back', 'Dumbbell', 'חתירה בעמידה במשקולות'],
  ['Kettlebell Goblet Squat', 'Quadriceps', 'Kettlebell', 'גובלט סקוואט בקטלבל'],
  ['Kettlebell Deadlift', 'Hamstrings', 'Kettlebell', 'דדליפט בקטלבל'],
  ['Kettlebell Row', 'Back', 'Kettlebell', 'חתירה בקטלבל'],
  ['Band Bent-Over Row', 'Back', 'Band', 'חתירה בכפיפה בגומייה'],
  ['Band Romanian Deadlift', 'Hamstrings', 'Band', 'דדליפט רומני בגומייה'],
  ['Bodyweight Squat', 'Quadriceps', 'Bodyweight', 'סקוואט במשקל גוף'],
  ['Bodyweight Split Squat', 'Quadriceps', 'Bodyweight', 'מכרע במקום במשקל גוף'],
  ['Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell', 'דדליפט רומני במשקולות'],
  ['Floor Glute Bridge', 'Glutes', 'Bodyweight', 'גשר ישבן על הרצפה'],
  ['Wall Push-Up', 'Chest', 'Bodyweight', 'שכיבות סמיכה כנגד קיר'],
  ['Jump Rope', 'Cardio', 'Other', 'קפיצה בחבל'],
];

function slug(name: string) {
  return (
    'ex_' +
    name
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
}

const SECONDARY: Record<string, string[]> = {
  'Bench Press': ['Triceps'], 'Incline Bench Press': ['Triceps'], 'Decline Bench Press': ['Triceps'],
  'Dumbbell Bench Press': ['Triceps'], 'Incline Dumbbell Press': ['Triceps'], 'Chest Press Machine': ['Triceps'],
  'Push-Up': ['Triceps'], Dip: ['Triceps'],
  Deadlift: ['Hamstrings', 'Glutes'], 'Rack Pull': ['Glutes', 'Traps'], 'Back Extension': ['Glutes', 'Hamstrings'],
  'Barbell Row': ['Biceps'], 'Pendlay Row': ['Biceps'], 'T-Bar Row': ['Biceps'], 'Dumbbell Row': ['Biceps'],
  'Seated Cable Row': ['Biceps'], 'Machine Row': ['Biceps'], 'Iso-Lateral Row (Machine)': ['Biceps'], 'Lat Pulldown': ['Biceps'],
  'Wide-Grip Pulldown': ['Biceps'], 'Pull-Up': ['Biceps'], 'Chin-Up': ['Biceps'],
  'Overhead Press': ['Triceps'], 'Seated Dumbbell Press': ['Triceps'], 'Arnold Press': ['Triceps'],
  'Machine Shoulder Press': ['Triceps'], 'Upright Row': ['Traps'],
  'Close-Grip Bench Press': ['Chest'], 'Triceps Dip': ['Chest'], 'Hammer Curl': ['Forearms'],
  'Back Squat': ['Glutes'], 'Front Squat': ['Glutes'], 'Hack Squat': ['Glutes'], 'Smith Machine Squat': ['Glutes'],
  'Goblet Squat': ['Glutes'], 'Leg Press': ['Glutes'], 'Bulgarian Split Squat': ['Glutes'], 'Walking Lunge': ['Glutes'],
  'Romanian Deadlift': ['Glutes'], 'Stiff-Leg Deadlift': ['Glutes'], 'Good Morning': ['Glutes'],
  'Hip Thrust': ['Hamstrings'], 'Glute Bridge': ['Hamstrings'], 'Sumo Deadlift': ['Quadriceps', 'Hamstrings'],
};

// Practical default rep ranges (Schoenfeld 2017/2021: ~6–30 reps grow muscle near failure).
const HEAVY = ['Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Deadlift', 'Barbell Row', 'Pendlay Row',
  'Overhead Press', 'Back Squat', 'Front Squat', 'Romanian Deadlift', 'Sumo Deadlift', 'Rack Pull',
  'Close-Grip Bench Press', 'Hip Thrust', 'Hack Squat', 'Pull-Up', 'Chin-Up', 'T-Bar Row'];
const HIGH = ['Lateral Raise', 'Cable Lateral Raise', 'Face Pull', 'Reverse Fly', 'Standing Calf Raise',
  'Seated Calf Raise', 'Leg Press Calf Raise', 'Crunch', 'Machine Crunch', 'Cable Crunch', 'Hanging Leg Raise',
  'Decline Sit-Up', 'Russian Twist', 'Wrist Curl', 'Reverse Wrist Curl', 'Abduction Machine', 'Cable Kickback'];
const ISO = ['Dumbbell Fly', 'Cable Fly', 'Cable Fly Crossover', 'Butterfly (Pec Deck)', 'Leg Extension',
  'Lying Leg Curl', 'Seated Leg Curl', 'Front Raise', 'Straight-Arm Pulldown', 'Barbell Shrug', 'Dumbbell Shrug',
  'Upright Row'];
// Loaded at long muscle lengths — preferred when suggesting a swap (Maeo 2021; Pedrosa 2022).
const LENGTHENED = ['Seated Leg Curl', 'Romanian Deadlift', 'Stiff-Leg Deadlift', 'Incline Dumbbell Curl',
  'Overhead Triceps Extension', 'Dumbbell Fly', 'Cable Fly', 'Cable Fly Crossover', 'Incline Dumbbell Press',
  'Bulgarian Split Squat', 'Walking Lunge', 'Hack Squat', 'Pull-Up', 'Lat Pulldown', 'Standing Calf Raise',
  'Leg Press Calf Raise', 'Behind-the-Back Cable Curl', 'Cable Lateral Raise', 'Dip', 'Good Morning'];

function repRange(name: string, primary: string): [number, number] {
  if (HEAVY.includes(name)) return [6, 10];
  if (HIGH.includes(name)) return [12, 20];
  if (ISO.includes(name) || ['Biceps', 'Triceps', 'Forearms'].includes(primary)) return [10, 15];
  return [8, 12];
}

// Bump when built-in data changes so existing installs merge the update.
export const SEED_VERSION = 8;

export function builtinExercises(): Exercise[] {
  return RAW.map(([name, primary, equipment, nameHe, pinned]) => {
    const id = pinned ?? slug(name);
    const [repMin, repMax] = repRange(name, primary);
    return {
      id,
      name,
      nameHe,
      primary,
      secondary: SECONDARY[name] ?? [],
      lengthened: LENGTHENED.includes(name),
      repMin,
      repMax,
      equipment,
      isCustom: false,
      tracking: primary === 'Cardio' ? 'cardio' : 'weight',
      image: EXERCISE_IMAGES[id] ? id : null,
      createdAt: Date.now(),
    };
  });
}

// Routines shipped with Lift, added once (by key) and never re-added after deletion.
type Tuple = [SetType, number, number];
const BUNDLED: Array<{ key: string; name: string; items: Array<[string, number, Tuple[]]> }> = [
  {
    key: 'hevy:klI9RXBzbpC',
    name: 'B2',
    items: [
      ['ex_pull_up', 90, [['normal', 20, 7], ['normal', 20, 7], ['normal', 20, 6]]],
      ['ex_iso_lateral_row_machine', 90, [['warmup', 27.5, 8], ['normal', 55, 11], ['normal', 55, 11], ['normal', 55, 11]]],
      ['ex_lying_leg_curl', 90, [['warmup', 27.5, 8], ['normal', 55, 11], ['normal', 55, 9], ['normal', 50, 10]]],
      ['ex_goblet_squat', 90, [['normal', 28, 10], ['normal', 20, 10], ['normal', 22, 10], ['normal', 28, 10], ['normal', 20, 10], ['normal', 22, 10]]],
      ['ex_behind_the_back_cable_curl', 90, [['normal', 7.5, 10], ['normal', 7.5, 12], ['normal', 7.5, 10], ['normal', 7.5, 10]]],
      ['ex_machine_crunch', 90, [['normal', 42.5, 13], ['normal', 42.5, 13], ['normal', 45, 13]]],
    ],
  },
];

export function bundledRoutines(): Array<Omit<Routine, 'id' | 'order' | 'createdAt' | 'updatedAt'> & { bundledKey: string }> {
  return BUNDLED.map((b) => ({
    bundledKey: b.key,
    name: b.name,
    notes: '',
    items: b.items.map(
      ([exerciseId, restSec, sets]): RoutineItem => ({
        exerciseId,
        restSec,
        notes: '',
        sets: sets.map(([type, weight, reps]) => ({ type, weight, reps })),
      }),
    ),
  }));
}
