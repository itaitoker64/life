const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Exercise native-independent TypeScript directly without adding a test framework.
function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(__dirname, '..', file);
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} }; cache.set(file, module.exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = name => name in mocks ? mocks[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
    new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
    cache.set(file, module.exports); return module.exports;
  };
}
const load = loader();
const { emptyPlanning, plannedSessions, completedSessions, matchSessions, summarizePeriod, validDate, validTime } = load('src/planning/model.ts');
const { workoutReminders } = load('src/planning/reminderModel.ts');
const rule = (extra = {}) => ({ id: 'a', weekday: 0, kind: 'strength', title: 'A', routineId: 'routine-a', startDate: '2026-10-04', ...extra });
const session = (extra = {}) => ({ id: 's', date: '2026-10-04', kind: 'strength', title: 'A', routineId: 'routine-a', ...extra });
const actual = (extra = {}) => ({ id: 'done', date: '2026-10-04', kind: 'strength', title: 'A', routineId: 'routine-a', km: 0, ...extra });

test('recurring schedules respect their start/end date across month boundaries', () => {
  const data = emptyPlanning(); data.rules = [rule({ endDate: '2026-11-01' })];
  assert.deepEqual(plannedSessions(data, [], '2026-09-27', '2026-11-08').map(p => p.date), ['2026-10-04','2026-10-11','2026-10-18','2026-10-25','2026-11-01']);
});
test('moving one occurrence works across queried weeks without changing other weeks', () => {
  const data = emptyPlanning(); data.rules = [rule()];
  data.overrides = [{ id: 'weekly:a:2026-10-04', originalDate: '2026-10-04', date: '2026-10-12' }];
  assert.equal(plannedSessions(data, [], '2026-10-04', '2026-10-10').length, 0);
  assert.deepEqual(plannedSessions(data, [], '2026-10-11', '2026-10-17').map(p => p.date), ['2026-10-11','2026-10-12']);
});
test('cancelled occurrences stay absent without cancelling the series', () => {
  const data = emptyPlanning(); data.rules = [rule()];
  data.overrides = [{ id: 'weekly:a:2026-10-04', originalDate: '2026-10-04', date: '2026-10-04', cancelled: true }];
  assert.deepEqual(plannedSessions(data, [], '2026-10-04', '2026-10-11').map(p => p.date), ['2026-10-11']);
});
test('detailed coach runs replace generic recurring runs and rest stays empty', () => {
  const data = emptyPlanning(); data.rules = [rule({ kind: 'run', routineId: undefined })];
  const coach = [{ id: 'c', plan_date: '2026-10-04', workout_type: 'easy', title: 'Easy', status: 'planned' }, { id: 'r', plan_date: '2026-10-11', workout_type: 'rest' }];
  assert.deepEqual(plannedSessions(data, coach, '2026-10-04', '2026-10-04').map(p => p.id), ['coach:c']);
});
test('one actual workout never completes two plans; exact routine wins', () => {
  const plans = [session({ id: 'generic', routineId: undefined }), session({ id: 'exact' })];
  const matches = matchSessions(plans, [actual()]);
  assert.equal(matches.size, 1); assert.equal(matches.get('exact'), 'done');
  assert.equal(matchSessions([session()], [actual({ routineId: 'other' })]).size, 0);
});
test('weekly nutrition excludes future and missing logs and uses elapsed days', () => {
  const totals = [{ date: '2026-10-04', kcal: 2000, protein: 140 }, { date: '2026-10-05', kcal: 2400, protein: 120 }, { date: '2026-10-09', kcal: 2000, protein: 150 }];
  const summary = summarizePeriod([session()], [actual(), actual({ id: 'extra', date: '2026-10-05', kind: 'run', km: 5 })], totals, '2026-10-04', '2026-10-10', '2026-10-06', { kcal: 2000, protein: 140 });
  assert.equal(summary.elapsedDays, 3); assert.equal(summary.loggedDays, 2);
  assert.equal(summary.calorieDays, 1); assert.equal(summary.proteinDays, 1);
  assert.equal(summary.matched, 1); assert.equal(summary.extra, 1); assert.equal(summary.km, 5);
});
test('no logs or zero targets never count as achieved', () => {
  const summary = summarizePeriod([], [], [], '2026-10-04', '2026-10-10', '2026-10-06', { kcal: 0, protein: 0 });
  assert.equal(summary.loggedDays, 0); assert.equal(summary.calorieDays, 0); assert.equal(summary.proteinDays, 0);
});
test('completed coach marks are counted once and skipped plans remain unmet', () => {
  const marked = session({ id: 'marked', kind: 'run', status: 'completed', routineId: undefined });
  const skipped = session({ id: 'skip', kind: 'run', status: 'skipped', routineId: undefined });
  const s = summarizePeriod([marked, skipped], [], [], '2026-10-04', '2026-10-10', '2026-10-06', { kcal: 2000, protein: 140 });
  assert.equal(s.planned, 2); assert.equal(s.completed, 1); assert.equal(s.matched, 1);
});
test('reminders group same-day sessions, skip completed/skipped and past times', () => {
  const settings = { workoutEnabled: true, workoutTime: '18:00' };
  const plans = [session({ id: 'today', date: '2026-10-06' }), session({ id: 'next', date: '2026-10-07' }), session({ id: 'run', kind: 'run', date: '2026-10-07' }), session({ id: 'skip', status: 'skipped', date: '2026-10-08' }), session({ id: 'far', date: '2026-11-04' })];
  const reminders = workoutReminders(settings, plans, [], new Date(2026, 9, 6, 19));
  assert.equal(reminders.length, 1); assert.equal(reminders[0].date, '2026-10-07');
  assert.equal(reminders[0].at.getHours(), 18); assert.equal(reminders[0].body, 'A · A');
  assert.equal(workoutReminders({ ...settings, workoutEnabled: false }, plans, [], new Date(2026, 9, 6)).length, 0);
});
test('date/time validation rejects rolled-over days and malformed clock values', () => {
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2026-10-06'), true);
  assert.equal(validTime('24:00'), false); assert.equal(validTime('9:00'), false); assert.equal(validTime('09:00'), true);
});
test('activity timestamps are assigned to their local calendar day', () => {
  const date = new Date(2026, 9, 6, 0, 30);
  assert.equal(completedSessions([], [{ id: 'r', start_time: date.toISOString(), distance_m: 5000, name: null }])[0].date, '2026-10-06');
});
test('legacy schedules migrate once, serialized writes survive failure and reload', async () => {
  let saved = null; let failNext = false;
  const store = loader({
    '../db/docs': { loadDoc: async () => saved, saveDoc: async (_, __, value) => { if (failNext) { failNext = false; throw Error('disk'); } saved = JSON.parse(JSON.stringify(value)); } },
    '../strength/store': { L: { settings: { scheduledWorkouts: [{ date: '2026-10-06', routineId: 'a' }] }, routines: [{ id: 'a', name: 'A' }] } },
  })('src/planning/store.ts');
  await store.initPlanning(); assert.equal(store.usePlanning.getState().data.sessions.length, 1);
  await store.initPlanning(); assert.equal(store.usePlanning.getState().data.sessions.length, 1);
  failNext = true;
  await assert.rejects(store.updatePlanning(d => ({ ...d, sessions: [] })));
  assert.equal(store.usePlanning.getState().data.sessions.length, 1);
  await Promise.all([store.updatePlanning(d => ({ ...d, sessions: [...d.sessions, session({ id: 'a' })] })), store.updatePlanning(d => ({ ...d, sessions: [...d.sessions, session({ id: 'b' })] }))]);
  await store.initPlanning(); assert.equal(store.usePlanning.getState().data.sessions.length, 3);
});

test('notification reconciliation is idempotent and preserves unrelated/rest alerts', async () => {
  const date = new Date(); date.setDate(date.getDate() + 1);
  const { toISODate } = load('src/lib/dates.ts');
  let data = emptyPlanning();
  data.sessions = [session({ date: toISODate(date) })];
  data.reminders.workoutEnabled = true; data.reminders.mealsEnabled = true;
  const pending = new Map([['rest-timer', { identifier: 'rest-timer', content: { title: 'Rest' } }], ['another-feature', { identifier: 'another-feature', content: {} }]]);
  let scheduleCalls = 0;
  const native = loader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-notifications': {
      AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
      setNotificationChannelAsync: async () => {}, getPermissionsAsync: async () => ({ granted: true }),
      requestPermissionsAsync: async () => { throw Error('must not prompt during sync'); },
      getAllScheduledNotificationsAsync: async () => [...pending.values()],
      cancelScheduledNotificationAsync: async id => pending.delete(id),
      scheduleNotificationAsync: async request => { scheduleCalls++; pending.set(request.identifier, { identifier: request.identifier, content: request.content }); },
    },
    './store': { usePlanning: { getState: () => ({ ready: true, data }) } },
    '../run/store': { R: { plans: [], activities: [] } },
    '../strength/store': { L: { workouts: [] } },
  })('src/planning/reminders.ts');
  await native.syncReminders(); assert.equal(scheduleCalls, 4); assert.equal(pending.size, 6);
  await native.syncReminders(); assert.equal(scheduleCalls, 4);
  data = { ...data, reminders: { ...data.reminders, workoutTime: '17:00' } };
  await native.syncReminders(); assert.equal(scheduleCalls, 5);
  data = { ...data, reminders: { ...data.reminders, workoutEnabled: false, mealsEnabled: false } };
  await native.syncReminders(); assert.deepEqual([...pending.keys()].sort(), ['another-feature','rest-timer']);
});

test('a completed coach plan matches its run before a duplicate generic plan', () => {
  const plans = [session({ id: 'generic', kind: 'run', routineId: undefined }), session({ id: 'coach', kind: 'run', routineId: undefined, coachDate: '2026-10-04', status: 'completed' })];
  const summary = summarizePeriod(plans, [actual({ kind: 'run', routineId: undefined, km: 4 })], [], '2026-10-04', '2026-10-10', '2026-10-06', { kcal: 2000, protein: 140 });
  assert.equal(summary.completed, 1); assert.equal(summary.matched, 1);
});
