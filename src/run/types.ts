// Running data model, from Stride (web/src/lib/types.ts), stored locally.
import type { PaceZone } from './science';

export type WorkoutType = 'easy' | 'recovery' | 'long' | 'tempo' | 'threshold' | 'intervals' | 'progression' | 'rest' | 'race';
export type PlanStatus = 'planned' | 'completed' | 'skipped';

export interface Activity {
  id: string; // intervals.icu activity id (or a Stride import id)
  source: 'intervals' | 'stride';
  start_time: string;
  name: string | null;
  distance_m: number;
  duration_s: number;
  avg_pace_sec_per_km: number | null;
  gap_sec_per_km: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  avg_cadence_spm: number | null;
  training_load: number | null;
}

export interface CoachingPlan {
  id: string; // = plan_date
  plan_date: string;
  workout_type: WorkoutType;
  title: string;
  description: string | null;
  duration_min: number | null;
  distance_km: number | null;
  target_pace_fast_sec_km: number | null;
  target_pace_slow_sec_km: number | null;
  hr_zone: number | null;
  rationale: string;
  adaptation_note: string | null;
  adjustment_sec: number;
  status: PlanStatus;
}

export interface CoachAssessment {
  id: string;
  assessed_at: string;
  fatigue_level: 'low' | 'moderate' | 'high';
  readiness_score: number;
  marathon_shape_pct: number | null;
  acwr: number | null;
  summary: string;
  vdot: number | null;
  vdot_source: string | null;
  training_paces: Record<'recovery' | 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition', PaceZone> | null;
  race_predictions: { name: string; distance_km: number; predicted_s: number; target_s: number | null }[] | null;
  phase: string | null;
  weekly_km_target: number | null;
}

export interface Race {
  id: string;
  name: string;
  race_date: string;
  distance_km: number;
  target_time_s: number | null;
  priority: 'A' | 'B' | 'C';
}

export interface RunProfile {
  hr_max: number;
  hr_rest: number;
  weekly_km_target: number | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  sync_error: string | null;
}

export const DEFAULT_RUN_PROFILE: RunProfile = {
  hr_max: 185,
  hr_rest: 55,
  weekly_km_target: null,
  last_sync_at: null,
  last_sync_status: null,
  sync_error: null,
};
