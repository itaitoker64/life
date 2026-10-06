import type { ActivityLevel, GoalType, ProteinMode, Sex } from '../lib/tdee';
import type { Units } from '../lib/units';
import type { ISODate } from '../lib/dates';

export type FoodSource = 'user' | 'off' | 'ai' | 'moh';
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_SHORT: Record<Meal, string> = { breakfast: 'בוקר', lunch: 'צהריים', dinner: 'ערב', snack: 'נשנוש' };
export const MEAL_OPTS = MEALS.map((m) => ({ value: m, label: MEAL_SHORT[m] }));

// Nutrients are per 100 g.
export interface Food {
  id: number;
  name: string;
  name_en: string | null;
  brand: string | null;
  barcode: string | null;
  source: FoodSource;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium_mg: number | null;
  serving_g: number | null;
  serving_name: string | null;
  image_url: string | null;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
}

export type FoodInput = Omit<Food, 'id' | 'created_at' | 'last_used_at' | 'use_count'>;

export interface LogEntry {
  id: number;
  date: ISODate;
  meal: Meal;
  food_id: number | null;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  components: string | null;
  created_at: string;
}

export type LogEntryInput = Omit<LogEntry, 'id' | 'created_at' | 'components'> & { components?: string | null };

// One ingredient of a logged dish, with nutrients for the amount actually in the dish.
export interface EntryComponent {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function parseComponents(json: string | null): EntryComponent[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) && v.length ? (v as EntryComponent[]) : null;
  } catch {
    return null;
  }
}

export interface WeightEntry {
  id: number;
  date: ISODate;
  weight_kg: number;
  note: string | null;
}

export interface Profile {
  id: 1;
  onboarded: number;
  sex: Sex;
  birth_year: number;
  height_cm: number;
  activity: ActivityLevel;
  units: Units;
  goal: GoalType;
  rate_kg_week: number;
  rate_pct_week: number;
  goal_weight_kg: number | null;
  protein_mode: ProteinMode;
  protein_g_kg: number;
  fat_pct: number;
  tdee: number;
  target_kcal: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  program_start: ISODate | null;
  program_since: ISODate | null;
  checkin_count: number;
  last_checkin: ISODate | null;
  last_expenditure_update: ISODate | null;
}

export interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}
