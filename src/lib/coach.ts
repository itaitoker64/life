import { getProfile, recordExpenditure, updateProfile } from '../db/profile';
import { allWeights, latestWeight } from '../db/weight';
import { dailyIntake } from '../db/log';
import { addDays, daysBetween, today } from './dates';
import { computeTargets, computeTrend, estimateExpenditure, type MacroTargets, type TrendPoint } from './tdee';
import type { Profile } from '../db/types';

export const CHECKIN_INTERVAL_DAYS = 7;

export async function currentTrend(): Promise<TrendPoint[]> {
  const weights = await allWeights();
  return computeTrend(weights.map((w) => ({ date: w.date, kg: w.weight_kg })));
}

export async function currentTrendWeight(): Promise<number | null> {
  const trend = await currentTrend();
  if (trend.length) return trend[trend.length - 1].trend;
  const latest = await latestWeight();
  return latest?.weight_kg ?? null;
}

// Re-estimates expenditure once per calendar day (idempotent). Targets do not move here —
// they only change when a check-in is accepted.
export async function updateExpenditureIfNeeded(force = false): Promise<Profile> {
  const profile = await getProfile();
  const t = today();
  if (!profile.onboarded) return profile;
  if (!force && profile.last_expenditure_update === t) return profile;

  const trend = await currentTrend();
  const intake = await dailyIntake(addDays(t, -30), addDays(t, -1));
  const result = estimateExpenditure({
    priorTdee: profile.tdee,
    days: intake.map((d) => ({ date: d.date, intakeKcal: d.kcal })),
    trend,
  });
  await recordExpenditure(t, result.tdee, result.rawEstimate, result.loggedDays);
  return updateProfile({ tdee: result.tdee, last_expenditure_update: t });
}

export function targetInput(profile: Profile, weightKg: number) {
  return {
    tdee: profile.tdee,
    weightKg,
    heightCm: profile.height_cm,
    sex: profile.sex,
    activity: profile.activity,
    goal: profile.goal,
    ratePctPerWeek: profile.rate_pct_week,
    proteinMode: profile.protein_mode,
    proteinGPerKg: profile.protein_g_kg,
    fatPct: profile.fat_pct,
  };
}

// Sets targets directly from the current data, no smoothing. Used at onboarding and whenever the
// user changes the goal or macro preferences themselves.
export async function applyTargets(profileOverride?: Profile): Promise<Profile> {
  const profile = profileOverride ?? (await getProfile());
  const weightKg = (await currentTrendWeight()) ?? 75;
  const targets = computeTargets(targetInput(profile, weightKg));
  return updateProfile({
    target_kcal: targets.calories,
    target_protein: targets.protein,
    target_carbs: targets.carbs,
    target_fat: targets.fat,
  });
}

export interface CheckinProposal {
  profile: Profile;
  weightKg: number;
  current: { calories: number; protein: number; carbs: number; fat: number };
  next: MacroTargets;
  deltas: { calories: number; protein: number; carbs: number; fat: number };
  tdee: number;
  loggedDays: number;
  observedWeeklyKg: number | null;
  hasChanges: boolean;
}

// Builds next week's program from the freshly re-estimated expenditure, smoothed so the targets
// move gradually instead of tracking every weekly wobble in the expenditure estimate.
export async function buildProposal(): Promise<CheckinProposal> {
  const profile = await updateExpenditureIfNeeded(true);
  const trend = await currentTrend();
  const weightKg = trend.length ? trend[trend.length - 1].trend : ((await latestWeight())?.weight_kg ?? 75);

  const intake = await dailyIntake(addDays(today(), -21), addDays(today(), -1));
  const loggedDays = intake.filter((d) => d.kcal > 0).length;

  let observedWeeklyKg: number | null = null;
  if (trend.length > 3) {
    const back = Math.min(21, trend.length - 1);
    const from = trend[trend.length - 1 - back];
    const to = trend[trend.length - 1];
    const days = Math.max(1, daysBetween(from.date, to.date));
    observedWeeklyKg = ((to.trend - from.trend) / days) * 7;
  }

  const next = computeTargets({ ...targetInput(profile, weightKg), smoothFrom: profile.target_kcal });
  const current = {
    calories: profile.target_kcal,
    protein: profile.target_protein,
    carbs: profile.target_carbs,
    fat: profile.target_fat,
  };
  const deltas = {
    calories: next.calories - current.calories,
    protein: next.protein - current.protein,
    carbs: next.carbs - current.carbs,
    fat: next.fat - current.fat,
  };
  return {
    profile,
    weightKg,
    current,
    next,
    deltas,
    tdee: profile.tdee,
    loggedDays,
    observedWeeklyKg,
    hasChanges: Object.values(deltas).some((d) => d !== 0),
  };
}

export async function acceptProposal(p: CheckinProposal): Promise<Profile> {
  const t = today();
  return updateProfile({
    target_kcal: p.next.calories,
    target_protein: p.next.protein,
    target_carbs: p.next.carbs,
    target_fat: p.next.fat,
    last_checkin: t,
    program_since: t,
    checkin_count: p.profile.checkin_count + 1,
  });
}

// Keeps the existing program and silences the prompt until the next check-in is due.
export async function declineProposal(p: CheckinProposal): Promise<Profile> {
  return updateProfile({ last_checkin: today(), checkin_count: p.profile.checkin_count + 1 });
}

export function checkinDaysRemaining(profile: Profile): number {
  const from = profile.last_checkin ?? profile.program_start;
  if (!from) return 0;
  return Math.max(0, CHECKIN_INTERVAL_DAYS - daysBetween(from, today()));
}

export function checkinDue(profile: Profile): boolean {
  return profile.onboarded === 1 && checkinDaysRemaining(profile) === 0;
}
