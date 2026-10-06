// First-session weight for an exercise with no history, estimated from lifts already logged.
// Ratios compare estimated 1RMs (dumbbell weights are per hand) and are deliberately conservative;
// after one real session the progression coach replaces the estimate.
import { L, exerciseBests, exerciseName } from './store';

const SOURCES: Record<string, Array<[string, number]>> = {
  ex_back_squat: [['ex_romanian_deadlift', 0.95], ['ex_bench_press', 1.0], ['ex_goblet_squat', 2.0]],
  ex_deadlift: [['ex_romanian_deadlift', 1.25], ['ex_bench_press', 1.2]],
  ex_leg_press: [['ex_romanian_deadlift', 1.8], ['ex_bench_press', 1.8]],
  ex_seated_leg_curl: [['ex_romanian_deadlift', 0.45], ['cx_db_rdl', 0.9]],
  ex_lying_leg_curl: [['ex_romanian_deadlift', 0.4], ['cx_db_rdl', 0.8]],
  ex_standing_calf_raise: [['cx_db_calf_raise', 2.0]],
  ex_barbell_row: [['cx_chest_supported_row', 1.6], ['ex_bench_press', 0.65]],
  ex_overhead_press: [['ex_arnold_press', 2.2], ['ex_bench_press', 0.6]],
  ex_lat_pulldown: [['cx_chest_supported_row', 1.6], ['ex_bench_press', 0.7]],
  ex_lateral_raise: [['ex_arnold_press', 0.45]],
  ex_dumbbell_curl: [['ex_hammer_curl', 0.85]],
  ex_cable_fly: [['ex_incline_dumbbell_press', 0.5], ['ex_bench_press', 0.18]],
  ex_face_pull: [['ex_triceps_pushdown', 0.8], ['cx_chest_supported_row', 0.6]],
  ex_cable_crunch: [['ex_triceps_pushdown', 1.3]],
  ex_incline_dumbbell_press: [['ex_bench_press', 0.33]],
  ex_bench_press: [['ex_incline_dumbbell_press', 3.0]],
  ex_romanian_deadlift: [['cx_db_rdl', 2.0]],
  ex_triceps_pushdown: [['cx_multi_pushdown', 1.0]],
};

export function estimateStart(exId: string, reps: number): { weight: number; from: string } | null {
  for (const [src, ratio] of SOURCES[exId] ?? []) {
    if (!L.exercises.some((e) => e.id === src)) continue;
    const e1 = exerciseBests(src).e1rm;
    if (!e1) continue;
    // Two reps in reserve at the bottom of the range, then 10% off for an unfamiliar movement.
    const raw = ((e1 * ratio) / (1 + (reps + 2) / 30)) * 0.9;
    const step = raw < 10 ? 1 : 2.5;
    const weight = Math.round(raw / step) * step;
    if (weight <= 0) continue;
    return { weight, from: exerciseName(src) };
  }
  return null;
}
