// Data model ported 1:1 from Lift (lift/js/db.js) so Lift backups import without conversion.
// Weights are always stored in kg; timestamps are epoch milliseconds.

export type SetType = 'normal' | 'warmup' | 'drop' | 'fail';
export type SetGroup = 'work' | 'warmup' | 'drop';
export type Effort = 'easy' | 'good' | 'fail';
export type Tracking = 'weight' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  nameHe?: string;
  primary: string;
  secondary?: string[];
  lengthened?: boolean;
  repMin?: number;
  repMax?: number;
  equipment: string;
  isCustom: boolean;
  tracking: Tracking;
  image?: string | null;
  note?: string;
  createdAt: number;
}

// '' means "not entered yet" (Lift keeps that distinction for placeholders).
export type Num = number | '';

export interface RoutineSet {
  type: SetType;
  weight: Num;
  reps: Num;
}

export interface RoutineItem {
  exerciseId: string;
  restSec: number;
  repMin?: number;
  repMax?: number;
  superset?: string;
  notes: string;
  sets: RoutineSet[];
}

export interface Routine {
  id: string;
  name: string;
  notes: string;
  items: RoutineItem[];
  order: number;
  createdAt: number;
  updatedAt: number;
  bundledKey?: string;
}

export interface LiveSet {
  type: SetType;
  weight: Num;
  reps: Num;
  done: boolean;
  effort?: Effort;
  _pr?: string | null;
}

export interface LiveItem {
  exerciseId: string;
  notes: string;
  restSec: number;
  repMin: number;
  repMax: number;
  superset?: string;
  sets: LiveSet[];
  _failCheck?: boolean | 'done';
  _effortIdx?: number | null;
  _showNote?: boolean;
}

export interface ActiveWorkout {
  id: string;
  name: string;
  routineId: string | null;
  startedAt: number;
  resumedAt?: number;
  priorDurationSec?: number;
  resumed?: boolean;
  failChecksAssigned?: boolean;
  adaptationDeload?: boolean;
  equipmentAdjusted?: boolean;
  plannedSessionId?: string;
  trainingKind?: 'strength' | 'run' | 'crossfit';
  adaptationNotes?: string;
  items: LiveItem[];
  rest: { endsAt: number; duration: number; notificationId?: string | null } | null;
}

export interface DoneSet {
  type: SetType;
  weight: number;
  reps: number;
  done: true;
  effort?: Effort;
}

export interface WorkoutItem {
  exerciseId: string;
  notes: string;
  restSec: number;
  repMin?: number;
  repMax?: number;
  superset?: string;
  sets: DoneSet[];
}

export interface PR {
  exerciseId: string;
  hits: string[];
}

export interface Workout {
  id: string;
  name: string;
  routineId: string | null;
  startedAt: number;
  endedAt?: number;
  durationSec: number;
  notes: string;
  deload?: boolean;
  equipmentAdjusted?: boolean;
  plannedSessionId?: string;
  trainingKind?: 'strength' | 'run' | 'crossfit';
  items: WorkoutItem[];
  prs?: PR[];
}

export interface Measurement {
  id: string;
  type: string;
  value: number;
  date: number;
}

export interface LiftSettings {
  defaultRestSec: number;
  incKg: number;
  incLb: number;
  wakeLock: boolean;
  builtinVersion: number;
  weeklyGoal?: number;
  scheduledWorkouts?: Array<{ date: string; routineId: string }>;
  deload?: { start: number; end: number } | null;
  deloadSnoozeUntil?: number;
  lastDeloadEnd?: number;
  calibrations?: Array<{ t: number; exId: string; gap: number }>;
  bundledRoutines?: string[];
}

export const DEFAULT_SETTINGS: LiftSettings = {
  defaultRestSec: 120,
  incKg: 2.5,
  incLb: 5,
  wakeLock: true,
  builtinVersion: 0,
};
