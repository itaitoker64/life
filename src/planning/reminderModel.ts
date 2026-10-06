import { addDays, parseISODate, toISODate } from '../lib/dates';
import { matchSessions, validTime, type CompletedSession, type ReminderSettings, type Session } from './model';

export interface WorkoutReminder { id: string; at: Date; body: string; date: string }
/** Group same-day workouts so the OS notification queue stays small. */
export function workoutReminders(settings: ReminderSettings, plans: Session[], actual: CompletedSession[], now: Date): WorkoutReminder[] {
  if (!settings.workoutEnabled || !validTime(settings.workoutTime)) return [];
  const matches = matchSessions(plans, actual);
  const grouped = new Map<string, string[]>();
  const today = toISODate(now);
  const horizon = addDays(today, 27);
  for (const plan of plans) {
    if (plan.date < today || plan.date > horizon || plan.status === 'skipped' || matches.has(plan.id)) continue;
    grouped.set(plan.date, [...(grouped.get(plan.date) ?? []), plan.title]);
  }
  const [hour, minute] = settings.workoutTime.split(':').map(Number);
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, titles]) => {
    const at = parseISODate(date); at.setHours(hour, minute, 0, 0);
    return at > now ? [{ id: `life-reminder:workout:${date}`, at, date, body: titles.join(' · ') }] : [];
  });
}
