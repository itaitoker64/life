import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, today } from '../lib/dates';
import { R } from '../run/store';
import { L } from '../strength/store';
import { completedSessions, plannedSessions, validTime } from './model';
import { workoutReminders } from './reminderModel';
import { usePlanning } from './store';

const PREFIX = 'life-reminder:';
async function ensureChannel() {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('life-reminders', {
    name: 'תזכורות אימונים ותזונה', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default',
  });
}
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}
let queue: Promise<void> = Promise.resolve();
export function syncReminders(): Promise<void> {
  const task = queue.catch(() => {}).then(reconcile);
  queue = task;
  return task;
}
async function reconcile() {
  if (Platform.OS === 'web' || !usePlanning.getState().ready) return;
  const { data } = usePlanning.getState();
  const { reminders } = data;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const own = scheduled.filter(n => n.identifier.startsWith(PREFIX));
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted || (!reminders.workoutEnabled && !reminders.mealsEnabled)) {
    await Promise.all(own.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    return;
  }
  await ensureChannel();
  const plans = plannedSessions(data, R.plans, today(), addDays(today(), 27));
  const workouts = workoutReminders(reminders, plans, completedSessions(L.workouts, R.activities), new Date());
  const desired: Notifications.NotificationRequestInput[] = workouts.map(w => ({
    identifier: w.id,
    content: { title: 'האימון הבא שלך', body: w.body, sound: true, data: { screen: 'journal', date: w.date } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: w.at, channelId: 'life-reminders' },
  }));
  if (reminders.mealsEnabled) for (const time of [...new Set(reminders.mealTimes)].filter(validTime).slice(0, 3)) {
    const [hour, minute] = time.split(':').map(Number);
    desired.push({ identifier: `${PREFIX}meal:${time}`, content: { title: 'זמן לרשום את הארוחה', body: 'עדכון קצר ביומן התזונה יעזור לעקוב אחר היעדים.', sound: true, data: { screen: 'nutrition' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'life-reminders' } });
  }
  // Remove only Life reminders; preserve the active workout's rest timer.
  const ids = new Set(desired.map(n => n.identifier));
  await Promise.all(own.filter(n => !ids.has(n.identifier)).map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  for (const request of desired) {
    const previous = own.find(n => n.identifier === request.identifier);
    // Time changes are encoded separately because native trigger representations differ by OS.
    const stamp = request.trigger && 'date' in request.trigger ? new Date(request.trigger.date).getTime() : request.identifier;
    request.content = { ...request.content, data: { ...request.content?.data, reminderStamp: stamp } };
    if (previous && previous.content.body === request.content.body && previous.content.data?.reminderStamp === stamp) continue;
    if (previous) await Notifications.cancelScheduledNotificationAsync(previous.identifier);
    await Notifications.scheduleNotificationAsync(request);
  }
}
