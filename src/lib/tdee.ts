import { type ISODate, addDays, daysBetween } from './dates';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';

export const KCAL_PER_KG = 7700;
const TREND_ALPHA = 0.1;
const WINDOW_DAYS = 21;
const MIN_LOGGED_DAYS = 7;
const BLEND = 0.3;
const MAX_STEP = 150;
const TDEE_MIN = 1000;
const TDEE_MAX = 6000;

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function initialExpenditure(
  sex: Sex,
  weightKg: number,
  heightCm: number,
  age: number,
  activity: ActivityLevel,
): number {
  return Math.round(mifflinStJeor(sex, weightKg, heightCm, age) * ACTIVITY_MULTIPLIER[activity]);
}

export interface WeightPoint {
  date: ISODate;
  kg: number;
}

export interface TrendPoint {
  date: ISODate;
  kg: number | null;
  trend: number;
}

// Exponentially weighted trend, carried forward across days with no weigh-in.
export function computeTrend(entries: WeightPoint[]): TrendPoint[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(sorted.map((e) => [e.date, e.kg]));
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const out: TrendPoint[] = [];
  let trend = sorted[0].kg;
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const kg = byDate.get(d) ?? null;
    if (kg != null) trend = trend + TREND_ALPHA * (kg - trend);
    out.push({ date: d, kg, trend });
  }
  return out;
}

export interface DayEnergy {
  date: ISODate;
  intakeKcal: number | null;
}

export interface ExpenditureInput {
  priorTdee: number;
  days: DayEnergy[];
  trend: TrendPoint[];
}

export interface ExpenditureResult {
  tdee: number;
  loggedDays: number;
  rawEstimate: number | null;
}

// Energy balance over a rolling window: TDEE ≈ mean intake − (Δ trend weight × 7700) / days.
export function estimateExpenditure(input: ExpenditureInput): ExpenditureResult {
  const { priorTdee, days, trend } = input;
  if (trend.length < 2) return { tdee: priorTdee, loggedDays: 0, rawEstimate: null };

  const trendByDate = new Map(trend.map((t) => [t.date, t.trend]));
  const lastDate = trend[trend.length - 1].date;
  const startDate = addDays(lastDate, -WINDOW_DAYS);

  const window = days.filter(
    (d) => d.date > startDate && d.date <= lastDate && d.intakeKcal != null && d.intakeKcal > 0,
  );
  if (window.length < MIN_LOGGED_DAYS) {
    return { tdee: priorTdee, loggedDays: window.length, rawEstimate: null };
  }

  const firstLogged = window.reduce((a, b) => (a.date < b.date ? a : b)).date;
  const lastLogged = window.reduce((a, b) => (a.date > b.date ? a : b)).date;
  const span = Math.max(1, daysBetween(firstLogged, lastLogged));
  const trendStart = trendByDate.get(firstLogged) ?? trend[0].trend;
  const trendEnd = trendByDate.get(lastLogged) ?? trend[trend.length - 1].trend;

  const meanIntake = window.reduce((s, d) => s + (d.intakeKcal ?? 0), 0) / window.length;
  const dailyEnergyChange = ((trendEnd - trendStart) * KCAL_PER_KG) / span;
  const raw = meanIntake - dailyEnergyChange;

  let next = priorTdee + BLEND * (raw - priorTdee);
  next = Math.max(priorTdee - MAX_STEP, Math.min(priorTdee + MAX_STEP, next));
  next = Math.max(TDEE_MIN, Math.min(TDEE_MAX, next));

  return { tdee: Math.round(next), loggedDays: window.length, rawEstimate: Math.round(raw) };
}

// Rate of change as % of bodyweight per week.
export interface RatePreset {
  label: string;
  pct: number;
}

export const RATE_PRESETS: Record<Exclude<GoalType, 'maintain'>, RatePreset[]> = {
  lose: [
    { label: 'Slow', pct: 0.25 },
    { label: 'Moderate', pct: 0.5 },
    { label: 'Fast', pct: 0.75 },
    { label: 'Aggressive', pct: 1.0 },
  ],
  gain: [
    { label: 'Slow', pct: 0.1 },
    { label: 'Moderate', pct: 0.25 },
    { label: 'Fast', pct: 0.5 },
  ],
};

export const RATE_RANGE: Record<Exclude<GoalType, 'maintain'>, { min: number; max: number }> = {
  lose: { min: 0.1, max: 1.5 },
  gain: { min: 0.05, max: 0.75 },
};

export type RateSpeed = 'Slow' | 'Moderate' | 'Fast' | 'Aggressive';

export function rateSpeed(goal: GoalType, pct: number): RateSpeed {
  if (goal === 'gain') return pct < 0.18 ? 'Slow' : pct < 0.38 ? 'Moderate' : 'Fast';
  return pct < 0.38 ? 'Slow' : pct < 0.63 ? 'Moderate' : pct < 0.88 ? 'Fast' : 'Aggressive';
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinGPerKg: number;
  referenceWeightKg: number;
  minCaloriesApplied: boolean;
}

export type ProteinMode = 'auto' | 'custom';

export interface TargetInput {
  tdee: number;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  activity: ActivityLevel;
  goal: GoalType;
  ratePctPerWeek: number;
  proteinMode: ProteinMode;
  proteinGPerKg: number;
  fatPct: number;
}

export function weeklyChangeKg(goal: GoalType, ratePctPerWeek: number, weightKg: number): number {
  if (goal === 'maintain') return 0;
  const kg = (weightKg * ratePctPerWeek) / 100;
  return goal === 'lose' ? -kg : kg;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// Above a BMI of 27 only a quarter of the extra weight counts, so protein tracks lean mass
// rather than body fat (adjusted-body-weight approach used in clinical nutrition).
export function proteinReferenceWeightKg(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  const cap = 27 * m * m;
  return weightKg <= cap ? weightKg : cap + 0.25 * (weightKg - cap);
}

// Evidence-based range is 1.6–2.2 g/kg (Morton 2017 breakpoint 1.62, CI to 2.2); deficits and
// higher activity push toward the top, maintenance toward the bottom.
export function recommendedProteinGPerKg(goal: GoalType, activity: ActivityLevel): number {
  const base = goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.6;
  const adj = activity === 'sedentary' ? -0.1 : activity === 'active' || activity === 'very_active' ? 0.2 : 0;
  return Math.round(Math.min(2.4, Math.max(1.2, base + adj)) * 10) / 10;
}

export function minCalories(sex: Sex): number {
  return sex === 'female' ? 1200 : 1500;
}

export function computeTargets(input: TargetInput & { smoothFrom?: number }): MacroTargets {
  const { tdee, weightKg, heightCm, sex, activity, goal, ratePctPerWeek, proteinMode, fatPct, smoothFrom } = input;
  const dailyDelta = (weeklyChangeKg(goal, ratePctPerWeek, weightKg) * KCAL_PER_KG) / 7;
  const floor = minCalories(sex);
  const unsmoothed = Math.round(tdee + dailyDelta);
  const rawCalories = smoothFrom != null ? smoothCalorieTarget(smoothFrom, unsmoothed) : unsmoothed;
  const calories = Math.max(floor, rawCalories);

  const proteinGPerKg = proteinMode === 'auto' ? recommendedProteinGPerKg(goal, activity) : input.proteinGPerKg;
  const referenceWeightKg = proteinMode === 'auto' ? proteinReferenceWeightKg(weightKg, heightCm) : weightKg;
  const protein = Math.round(referenceWeightKg * proteinGPerKg);

  // Fat: chosen % of calories, but never below 0.6 g/kg (hormonal health) or above 40 %.
  const fatFromPct = (calories * Math.min(0.4, fatPct)) / 9;
  const fat = Math.round(Math.max(fatFromPct, 0.6 * weightKg));

  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat, proteinGPerKg, referenceWeightKg, minCaloriesApplied: rawCalories < floor };
}

// Check-in smoothing: targets never move 1:1 with a week's expenditure estimate, so a temporary
// stall or a big logging week can't whiplash the program. Changes land over several weeks instead.
export const CHECKIN_BLEND = 0.6;
export const CHECKIN_MAX_STEP = 250;

export function smoothCalorieTarget(previousTarget: number, rawTarget: number): number {
  const blended = previousTarget + CHECKIN_BLEND * (rawTarget - previousTarget);
  const capped = Math.max(previousTarget - CHECKIN_MAX_STEP, Math.min(previousTarget + CHECKIN_MAX_STEP, blended));
  return Math.round(capped / 5) * 5;
}

export function projectedWeeklyChangeKg(tdee: number, targetCalories: number): number {
  return ((targetCalories - tdee) * 7) / KCAL_PER_KG;
}

export function weeksToGoal(currentKg: number, goalKg: number, weeklyKg: number): number | null {
  const diff = goalKg - currentKg;
  if (weeklyKg === 0 || Math.sign(diff) !== Math.sign(weeklyKg)) return null;
  return diff / weeklyKg;
}
