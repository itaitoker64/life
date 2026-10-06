// One-time personal setup shipped by OTA: the owner's starting weights and goal weight.
// Runs once per install; existing data and a goal weight already set are left untouched.
import baseline from '../data/baseline-weights.json';
import { L, importLift, persist } from '../strength/store';
import { useApp } from '../state/store';

const GOAL_WEIGHT_KG = 81;

export async function applyPersonalSeed() {
  if (L.settings.baselineImported) return;
  const { profile, patchProfile } = useApp.getState();
  if (!profile?.onboarded) return;
  const ids = new Set(L.workouts.map((w) => w.id));
  if (!baseline.data.workouts.every((w) => ids.has(w.id))) await importLift(baseline, 'merge');
  if (profile.goal_weight_kg == null) await patchProfile({ goal_weight_kg: GOAL_WEIGHT_KG });
  L.settings.baselineImported = true;
  await persist.settings();
}
