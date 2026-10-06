// Extra carbs on demanding run days. Endurance guidelines (ACSM/IOC; Burke 2011) scale daily carbs
// with training load: ~3–5 g/kg on light days, ~5–7 g/kg on moderate days and more for long runs.
// This only suggests shifting carbs toward the session; the adaptive calorie target is unchanged.
import type { CoachingPlan } from '../run/types';

export interface FuelTip {
  grams: number;
  text: string;
}

export function carbTip(plan: CoachingPlan | null, weightKg: number | null): FuelTip | null {
  if (!plan || plan.status === 'skipped' || !weightKg) return null;
  const minutes = plan.duration_min ?? 0;
  const long = plan.workout_type === 'long' || plan.workout_type === 'race' || minutes >= 75;
  const quality = ['tempo', 'threshold', 'intervals', 'progression'].includes(plan.workout_type);
  if (long) {
    const g = Math.round(weightKg / 5) * 5;
    return {
      grams: g,
      text: `יום ${plan.workout_type === 'race' ? 'מרוץ' : 'ריצה ארוכה'}: כדאי בערך ${g} ג׳ פחמימות נוספות — בארוחה שלפני ובזו שאחרי — על חשבון מעט שומן.${minutes >= 90 ? ' מעל 90 דק׳ קחו גם 30–60 ג׳ לשעה תוך כדי.' : ''}`,
    };
  }
  if (quality) {
    const g = Math.round(weightKg / 2 / 5) * 5;
    return { grams: g, text: `אימון איכות היום: כדאי בערך ${g} ג׳ פחמימות נוספות סביב האימון, כדי שהקטעים המהירים יהיו באיכות.` };
  }
  return null;
}
