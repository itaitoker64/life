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

const { adaptSessions, setAdaptationProvider } = load('src/planning/adaptation.ts');
const context = (extra = {}) => ({ today: '2026-10-06', loads: [{ id: 'wod', date: '2026-10-06', title: 'WOD', minutes: 45, effort: 8, areas: ['legs'] }], routineAreas: { legs: ['legs'], upper: ['upper'] }, protectedDates: [], ...extra });
const next = (extra = {}) => session({ id: 'next', date: '2026-10-07', routineId: 'legs', ...extra });
test('hard leg WOD delays overlapping work but preserves upper-body split', () => {
  const result = adaptSessions([next(), next({ id: 'upper', routineId: 'upper' })], context(), []);
  assert.equal(result[0].date, '2026-10-08'); assert.equal(result[1].date, '2026-10-07');
  assert.match(result[0].adjustment.reason, /WOD/);
});
test('light alternate work does not cause compensatory training or schedule changes', () => {
  const plans = [next()]; assert.deepEqual(adaptSessions(plans, context({ loads: [{ ...context().loads[0], effort: 3 }] }), []), plans);
});
test('occupied days are not overloaded and unresolved conflicts stay visible', () => {
  const plans = [next(), next({ id: 'other', date: '2026-10-08' }), next({ id: 'another', date: '2026-10-09' })];
  const result = adaptSessions(plans, context(), []);
  assert.equal(result[0].date, '2026-10-07'); assert.match(result[0].adjustment.reason, /אין יום פנוי/);
  assert.equal(result[0].adjustment.mode, 'reduce');
  assert.equal(result[0].adjustment.factor, 0.7);
});
test('manual moves, completed work, history and race-adjacent dates are protected', () => {
  for (const extra of [{ manual: true }, { status: 'completed' }, { date: '2026-10-05' }]) {
    const plan = next(extra); assert.deepEqual(adaptSessions([plan], context(), []), [plan]);
  }
  const plan = next(); assert.deepEqual(adaptSessions([plan], context({ protectedDates: ['2026-10-08'] }), []), [plan]);
});
test('undo survives recomputation and a changed load creates a new decision', () => {
  const plan = next(), adjusted = adaptSessions([plan], context(), [])[0];
  assert.deepEqual(adaptSessions([plan], context(), [adjusted.adjustment.key]), [plan]);
  const changed = context({ loads: [{ ...context().loads[0], effort: 9 }] });
  assert.ok(adaptSessions([plan], changed, [adjusted.adjustment.key])[0].adjustment);
});
test('actual matching workout is never shifted into the future', () => {
  const plan = next(); const c = context({ loads: [{ ...context().loads[0], date: plan.date, kind: 'strength', routineId: 'legs' }] });
  assert.deepEqual(adaptSessions([plan], c, []), [plan]);
});
test('adaptation is stable across date-range queries and does not compound moves', () => {
  setAdaptationProvider(() => context());
  try {
    const data = emptyPlanning(); data.sessions = [next()];
    assert.equal(plannedSessions(data, [], '2026-10-08', '2026-10-08')[0].date, '2026-10-08');
    assert.equal(plannedSessions(data, [], '2026-10-06', '2026-10-12')[0].date, '2026-10-08');
    assert.equal(data.sessions[0].date, '2026-10-07');
    data.adaptationEnabled = false;
    assert.equal(plannedSessions(data, [], '2026-10-06', '2026-10-12')[0].date, '2026-10-07');
  } finally { setAdaptationProvider(() => undefined); }
});
test('a replacement is recorded once and does not leave the original workout due', () => {
  const data = emptyPlanning(); data.sessions = [next({ date: '2026-10-06' })];
  data.alternateWorkouts = [{ ...context().loads[0], replacementId: 'next' }];
  const replaced = plannedSessions(data, [], '2026-10-06', '2026-10-06');
  assert.equal(replaced[0].status, 'completed');
  assert.equal(matchSessions(replaced, completedSessions([], [], data)).get('next'), 'wod');
  assert.equal(completedSessions([], [], data).length, 1);
  data.alternateWorkouts[0].id = 'lift:actual';
  const actualWorkout = { id: 'actual', startedAt: new Date('2026-10-06T12:00:00Z').getTime(), name: 'WOD', routineId: null };
  assert.equal(completedSessions([actualWorkout], [], data).length, 1);
});
test('persisted moves survive midnight, and explicit undo restores the baseline', () => {
  const data = emptyPlanning(); data.sessions = [next()];
  const moved = adaptSessions(data.sessions, context(), [])[0];
  data.automaticAdjustments = [{ id: moved.id, date: moved.date, adjustment: moved.adjustment }];
  setAdaptationProvider(() => context({ today: '2026-10-08', loads: [] }));
  try {
    assert.equal(plannedSessions(data, [], '2026-10-06', '2026-10-12')[0].date, '2026-10-08');
    data.dismissedAdjustments = [moved.adjustment.key];
    assert.equal(plannedSessions(data, [], '2026-10-06', '2026-10-12')[0].date, '2026-10-07');
  } finally { setAdaptationProvider(() => undefined); }
});
test('reduced strength session keeps warm-ups and does not change the saved routine', () => {
  const { reducedStrengthItems } = load('src/planning/adaptation.ts');
  const item = { exerciseId: 'squat', notes: '', restSec: 90, repMin: 5, repMax: 8, sets: [{ type: 'warmup', weight: 30, reps: 5, done: false }, ...Array.from({ length: 3 }, () => ({ type: 'fail', weight: 100, reps: 6, done: false }))] };
  const reduced = reducedStrengthItems([item], 0.7)[0];
  assert.equal(reduced.sets.length, 3); assert.equal(reduced.sets[0].weight, 30);
  assert.equal(reduced.sets[1].weight, 90); assert.equal(reduced.sets[1].type, 'normal');
  assert.equal(item.sets.length, 4); assert.equal(item.sets[1].weight, 100);
});
test('running detail uses the reduced plan while completion preserves its baseline', () => {
  const data = emptyPlanning(); let saved;
  const scoped = loader({ '../db/docs': { saveDoc: async (_c, _id, value) => { saved = { ...value }; } }, '../lib/gemini': {}, '../lib/secrets': {}, './load': {}, './planner': {}, './science': {}, '../planning/store': { usePlanning: { getState: () => ({ data }) } } });
  const run = scoped('src/run/store.ts');
  const baseline = { id: '2026-10-07', plan_date: '2026-10-07', title: 'Intervals', workout_type: 'intervals', status: 'planned', duration_min: 50, distance_km: 8, target_pace_fast_sec_km: 250, target_pace_slow_sec_km: 280, adaptation_note: null };
  run.R.plans = [baseline, { ...baseline, id: '2026-10-08', plan_date: '2026-10-08' }, { ...baseline, id: '2026-10-09', plan_date: '2026-10-09' }];
  run.R.assessments = [{ training_paces: { easy: { fast: 400, slow: 460 } } }];
  const { setAdaptationProvider } = scoped('src/planning/adaptation.ts'); setAdaptationProvider(() => context());
  const reduced = run.planFor('2026-10-07');
  assert.equal(reduced.workout_type, 'easy'); assert.equal(reduced.duration_min, 35);
  assert.equal(reduced.target_pace_fast_sec_km, 400); assert.equal(baseline.workout_type, 'intervals');
  run.setPlanStatus(reduced, 'completed');
  assert.equal(baseline.status, 'completed'); assert.equal(saved.duration_min, 50); assert.equal(saved.plan_date, '2026-10-07');
});
test('resuming a recovery workout does not restore the intentionally removed sets', () => {
  const state = { active: null };
  const scoped = loader({ 'expo-notifications': {}, '../run/store': { R: { plans: [] } }, '../planning/store': {}, '../planning/model': {}, './coach': {}, './store': { L: state, routine: () => ({ items: [{ exerciseId: 'squat', sets: Array.from({ length: 3 }, () => ({ type: 'normal', weight: 100, reps: 6 })) }] }), defaultRepRange: () => ({ min: 5, max: 8 }), persist: { active: () => {} }, emit: () => {} } });
  const workout = scoped('src/strength/workout.ts');
  workout.resumeFinished({ id: 'recovery', name: 'Recovery', routineId: 'legs', startedAt: Date.now(), durationSec: 1200, deload: true, items: [{ exerciseId: 'squat', sets: [{ type: 'normal', weight: 90, reps: 6 }] }] });
  assert.equal(state.active.items[0].sets.length, 1); assert.equal(state.active.adaptationDeload, true);
});

// The combined plan coordinates frequency without rewriting the existing run coach.
const combined = load('src/training/combined.ts');
const equipment = load('src/training/equipment.ts');
const library = loader({ './images': { EXERCISE_IMAGES: {} } })('src/strength/seed.ts').builtinExercises();
const hybrid = extra => ({ enabled: true, startDate: '2026-10-04', level: 'returning', slots: [...combined.DEFAULT_SLOTS], routineIds: ['a','b'], ...extra });
const coachPlan = extra => ({ id: '2026-10-05', plan_date: '2026-10-05', workout_type: 'intervals', title: 'Intervals', status: 'planned', duration_min: 50, target_pace_fast_sec_km: 240, target_pace_slow_sec_km: 260, ...extra });
const exNamed = name => library.find(ex => ex.name === name);
const routineItem = (name, count = 3) => ({ exerciseId: exNamed(name).id, restSec: 120, notes: 'Original', repMin: 8, repMax: 12, sets: Array.from({ length: count }, () => ({ type: 'normal', weight: 100, reps: 10 })) });
const gym = (...keys) => ({ ...equipment.emptyInventory(), equipment: keys });

test('the starting split has two full-body days, two easy runs, one CrossFit and two rests', () => {
  assert.deepEqual(combined.validateProgram(hybrid()), []);
  const data = emptyPlanning(); data.combinedProgram = hybrid();
  data.rules = [rule({ id: 'a', weekday: 0, routineId: 'a' }), rule({ id: 'b', weekday: 4, routineId: 'b' }), rule({ id: 'cf', weekday: 2, kind: 'crossfit', routineId: 'cf' })];
  const plans = plannedSessions(data, [], '2026-10-04', '2026-10-10');
  assert.deepEqual(plans.map(p => p.kind), ['strength','run','crossfit','strength','run']);
  assert.deepEqual(plans.filter(p => p.kind === 'run').map(p => p.minutes), [25,25]);
});
test('the split rejects adjacent hard days including Saturday to Sunday', () => {
  assert.ok(combined.validateProgram(hybrid({ slots: ['strength','crossfit','run','rest','strength','run','rest'] })).length);
  assert.ok(combined.validateProgram(hybrid({ slots: ['strength','run','rest','run','strength','rest','crossfit'] })).length);
});
test('easy hybrid runs never inherit an interval pace or invent distance; races are preserved', () => {
  const baseline = coachPlan(); const effective = combined.combinedRunPlan(hybrid(), baseline);
  assert.equal(effective.workout_type, 'easy'); assert.equal(effective.target_pace_fast_sec_km, null);
  assert.equal(effective.distance_km, null); assert.equal(effective.duration_min, 25);
  assert.equal(baseline.workout_type, 'intervals'); assert.equal(baseline.duration_min, 50);
  const race = coachPlan({ plan_date: '2026-10-06', workout_type: 'race' });
  assert.equal(combined.combinedRunPlan(hybrid(), race), race);
  assert.equal(combined.combinedRunPlan(hybrid(), coachPlan({ plan_date: '2026-10-06' })).workout_type, 'rest');
});
test('changing or disabling the split does not rewrite earlier weeks', () => {
  const initial = hybrid(); const disabled = hybrid({ enabled: false, startDate: '2026-10-11' });
  assert.equal(combined.combinedRunPlan(disabled, coachPlan(), [initial]).duration_min, 25);
  assert.equal(combined.combinedRunPlan(disabled, coachPlan({ plan_date: '2026-10-12' }), [initial]).duration_min, 50);
  assert.equal(combined.combinedRunPlan(initial, coachPlan({ plan_date: '2026-10-03' })).duration_min, 50);
});
test('explicitly moved runs remain visible when the combined split changes their original day', () => {
  const data = emptyPlanning(); data.combinedProgram = hybrid();
  data.overrides = [{ id: 'coach:2026-10-06', originalDate: '2026-10-06', date: '2026-10-07' }];
  const plans = plannedSessions(data, [coachPlan({ id: '2026-10-06', plan_date: '2026-10-06' })], '2026-10-07', '2026-10-07');
  assert.equal(plans[0].id, 'coach:2026-10-06'); assert.equal(plans[0].manual, true);
});
test('full-body templates are usable with the real library and never copy bundled weights', () => {
  for (const variant of [0,1]) {
    const items = combined.fullBodyItems(library, variant, 'returning');
    assert.equal(items.length, 5); assert.ok(items.every(i => i.sets.length === 2));
    assert.ok(items.every(i => i.sets.every(s => s.weight === '')));
  }
  assert.equal(combined.crossfitItems(library, 'regular').length, 4);
});
test('equipment recognition cannot imply other machines, overhead clearance or floor space', () => {
  const available = gym('leg_press','dumbbells','bench','cable_high');
  assert.equal(equipment.exerciseAvailable(exNamed('Leg Press'), available), true);
  assert.equal(equipment.exerciseAvailable(exNamed('Chest Press Machine'), available), false);
  assert.equal(equipment.exerciseAvailable(exNamed('Seated Leg Curl'), available), false);
  assert.equal(equipment.exerciseAvailable(exNamed('Push-Up'), available), false);
  assert.equal(equipment.exerciseAvailable(exNamed('Seated Dumbbell Press'), { ...available, noOverhead: true }), false);
  assert.equal(equipment.exerciseAvailable(exNamed('Lat Pulldown'), { ...available, noOverhead: true }), false);
  assert.equal(equipment.exerciseAvailable(exNamed('Walking Lunge'), { ...gym('dumbbells','open_space'), smallSpace: true }), false);
  assert.equal(equipment.exerciseAvailable(exNamed('Crunch'), { ...gym('floor_space'), noFloor: true }), false);
  assert.equal(equipment.exerciseAvailable(exNamed('Dumbbell Bench Press'), gym('dumbbells','adjustable_bench')), true);
});
test('substitution preserves movement families and never invents a substitute for an unknown custom exercise', () => {
  const source = [routineItem('Leg Press'), routineItem('Chest Press Machine'), routineItem('Romanian Deadlift'), routineItem('Lat Pulldown')];
  const before = JSON.stringify(source);
  const result = equipment.tailorWorkout(source, library, gym('dumbbells','bench'), 'strength', 60);
  assert.equal(result.rows.length, 3); assert.equal(result.omitted.length, 1);
  assert.equal(result.rows[1].exerciseId, exNamed('Dumbbell Bench Press').id);
  assert.equal(result.rows[2].exerciseId, exNamed('Dumbbell Romanian Deadlift').id);
  assert.ok(result.rows.every(row => row.item.sets.every(set => set.weight === '' && set.type === 'normal')));
  assert.equal(JSON.stringify(source), before);
  const unknown = { ...exNamed('Leg Press'), id: 'custom', name: 'Unverified machine', isCustom: true };
  assert.equal(equipment.substituteExercise(unknown, [unknown, ...library], gym('leg_press'), new Set()), undefined);
});
test('same-name unfamiliar machines also start with blank weights and warm-ups are not counted as work', () => {
  const source = routineItem('Leg Press'); source.sets.unshift({ type: 'warmup', weight: 40, reps: 5 });
  const result = equipment.tailorWorkout([source], library, gym('leg_press'), 'strength', 45);
  assert.equal(result.rows[0].changed, false); assert.equal(result.rows[0].item.sets.length, 3);
  assert.ok(result.rows[0].item.sets.every(s => s.weight === ''));
});
test('time-limited adaptation removes work visibly and does not add sets to compensate', () => {
  const source = ['Leg Press','Dumbbell Bench Press','Lat Pulldown','Romanian Deadlift','Crunch'].map(name => routineItem(name));
  const inventory = gym('leg_press','dumbbells','bench','cable_high','barbell','floor_space');
  const short = equipment.tailorWorkout(source, library, inventory, 'strength', 15);
  const long = equipment.tailorWorkout(source, library, inventory, 'strength', 60);
  assert.ok(short.omitted.some(s => s.includes('מסגרת הזמן')));
  assert.ok(short.rows.reduce((n,r) => n + r.item.sets.length,0) < long.rows.reduce((n,r) => n + r.item.sets.length,0));
  assert.ok(long.rows.every(r => r.item.sets.length <= 3));
});
test('a gym run prefers the treadmill, cycling preserves minutes without inventing kilometres', () => {
  const result = equipment.tailorWorkout([], [...library].reverse(), gym('bike','treadmill'), 'run', 25);
  assert.equal(result.rows[0].exerciseId, exNamed('Treadmill').id);
  const cycling = equipment.tailorWorkout([], library, gym('bike'), 'run', 25);
  assert.equal(cycling.rows[0].exerciseId, exNamed('Stationary Bike').id);
  assert.equal(cycling.rows[0].item.sets[0].weight, 25); assert.equal(cycling.rows[0].item.sets[0].reps, '');
  assert.ok(cycling.rows[0].reason.includes('אינו נספר'));
  assert.equal(equipment.tailorWorkout([], library, gym('dumbbells'), 'run', 25).rows.length, 0);
});
test('controlled CrossFit allows easy next-day aerobic work while very hard or accumulated load prompts recovery', () => {
  const easy = next({ kind: 'run', plannedEffort: 4, routineId: undefined });
  const regular = context({ loads: [{ id: 'cf', date: '2026-10-06', title: 'CF', kind: 'crossfit', effort: 7, minutes: 45, areas: ['legs'] }] });
  assert.equal(adaptSessions([easy], regular, [])[0].adjustment, undefined);
  assert.ok(adaptSessions([easy], { ...regular, loads: [{ ...regular.loads[0], effort: 9 }] }, [])[0].adjustment);
  const accumulated = { ...regular, loads: [regular.loads[0], { ...regular.loads[0], id: 'second', minutes: 45 }] };
  assert.ok(adaptSessions([easy], accumulated, [])[0].adjustment);
});
test('a saved spontaneous workout replaces its source once even when its training kind differs', () => {
  const plan = next({ date: '2026-10-06', kind: 'run', routineId: undefined });
  const load = { id: 'lift:cf', date: '2026-10-06', title: 'CF', kind: 'crossfit', replacementId: plan.id, minutes: 45, effort: 9, areas: ['legs'] };
  assert.equal(adaptSessions([plan], context({ loads: [load] }), [])[0].adjustment, undefined);
  const data = emptyPlanning(); data.workoutDrafts = [{ id: 'draft', kind: 'crossfit' }];
  assert.equal(completedSessions([], [], data).length, 0);
  const done = completedSessions([{ id: 'cf', name: 'CF', startedAt: new Date('2026-10-06T10:00:00Z').getTime(), durationSec: 1800, trainingKind: 'crossfit', plannedSessionId: plan.id, equipmentAdjusted: true }], [], data);
  assert.equal(matchSessions([plan, { ...plan, id: 'duplicate' }], done).size, 1);
  assert.equal(matchSessions([plan], done).get(plan.id), 'lift:cf');
  assert.equal(done[0].kind, 'crossfit'); assert.equal(done[0].km, 0); assert.equal(done[0].minutes, 30);
});
test('gym-photo parsing rejects unknown equipment; uncertain observations require manual confirmation', async () => {
  let sent; const resized = [];
  const scoped = loader({ 'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ resize: value => resized.push(value), renderAsync: async () => ({ saveAsync: async () => ({ base64: 'image' }) }) }) } }, '../lib/gemini': { generateJson: async options => { sent = options; return { data: { observations: [{ equipment: 'bike', confidence: 'high', evidence: 'Visible bike' }, { equipment: 'leg_press', confidence: 'low', evidence: 'Unclear' }, { equipment: 'bike', confidence: 'high', evidence: 'Second angle' }], notes: '' }, usage: { model: 'test', input: 1, output: 1 } }; } }, '../db/usage': { recordAiUsage: async () => {} } });
  const vision = scoped('src/training/vision.ts');
  await assert.rejects(vision.inspectGym([])); await assert.rejects(vision.inspectGym(Array(4).fill({ uri: 'image' })));
  const result = await vision.inspectGym([{ uri: 'image', width: 2000, height: 1000 }]);
  assert.deepEqual(resized, [{ width: 1280 }]); assert.equal(sent.parts.length, 1);
  assert.deepEqual(vision.clearlyVisibleEquipment(result.observations), ['bike']);
  assert.equal(vision.GymVisionSchema.safeParse({ observations: [{ equipment: 'imaginary_machine', confidence: 'high', evidence: '' }], notes: '' }).success, false);
});
test('starting and resuming a gym-adjusted workout keeps its snapshot and protects the original routine', () => {
  const state = { active: null, exercises: library }; let updated = 0;
  const original = { id: 'a', items: [routineItem('Leg Press')] };
  const source = { id: 'source', minutes: 35, adjustment: { mode: 'reduce', key: 'recovery', factor: 0.7 } };
  const scoped = loader({ 'expo-notifications': {}, '../run/store': { R: { plans: [] } }, '../planning/store': { usePlanning: { getState: () => ({ data: {} }) } }, '../planning/model': { plannedSessions: () => [source] }, './coach': {}, './store': { L: state, routine: () => original, defaultRepRange: () => ({ min: 8, max: 12 }), persist: { active: () => {} }, emit: () => {}, saveRoutine: () => updated++ } });
  const workout = scoped('src/strength/workout.ts');
  const row = equipment.tailorWorkout([routineItem('Leg Press')], library, gym('dumbbells'), 'strength', 45).rows[0];
  const draft = { title: 'Gym', kind: 'strength', sourceSessionId: 'source', sourceRoutineId: 'a', instructions: 'New equipment', rows: [row] };
  workout.startSpontaneousWorkout(draft);
  assert.equal(state.active.equipmentAdjusted, true); assert.equal(state.active.plannedSessionId, 'source');
  assert.equal(state.active.items[0].sets.length, 2); assert.ok(state.active.items[0].sets.every(s => s.weight === '' && !s.done));
  workout.updateRoutineFromWorkout(state.active); assert.equal(updated, 0);
  workout.startSpontaneousWorkout({ ...draft, rows: [{ ...row, item: { ...row.item, sets: row.item.sets.slice(0,2) } }], appliedAdjustmentKey: 'recovery' });
  assert.equal(state.active.items[0].sets.length, 2); // not reduced twice
  workout.resumeFinished({ id: 'adjusted', name: 'Gym', startedAt: Date.now(), routineId: 'a', durationSec: 600, equipmentAdjusted: true, trainingKind: 'strength', plannedSessionId: 'source', items: [{ ...row.item, sets: [{ type: 'normal', weight: 20, reps: 10 }] }] });
  assert.equal(state.active.items[0].exerciseId, row.exerciseId); assert.equal(state.active.items[0].sets.length, 1);
  assert.equal(state.active.plannedSessionId, 'source'); assert.equal(original.items[0].sets.length, 3);
});
test('an easy cardio substitute honours recovery by shortening duration, not just reducing a single set', () => {
  const state = { active: null, exercises: library };
  const scoped = loader({ 'expo-notifications': {}, '../run/store': { R: { plans: [] } }, '../planning/store': { usePlanning: { getState: () => ({ data: {} }) } }, '../planning/model': { plannedSessions: () => [{ id: 'source', minutes: 35, adjustment: { mode: 'reduce', key: 'r', factor: 0.7 } }] }, './coach': {}, './store': { L: state, persist: { active: () => {} }, emit: () => {} } });
  const workout = scoped('src/strength/workout.ts');
  const result = equipment.tailorWorkout([], library, gym('bike'), 'run', 35);
  workout.startSpontaneousWorkout({ title: 'Bike', kind: 'run', sourceSessionId: 'source', minutes: 35, instructions: '', rows: result.rows });
  assert.equal(state.active.items[0].sets[0].weight, 24.5); assert.equal(state.active.items[0].sets[0].reps, '');
});
test('synthetic run details can be completed and reload without generating a second plan', () => {
  const data = emptyPlanning(); data.combinedProgram = hybrid(); let saved;
  const scoped = loader({ '../db/docs': { saveDoc: async (_c, _id, value) => { saved = { ...value }; } }, '../lib/gemini': {}, '../lib/secrets': {}, './load': {}, './planner': {}, './science': {}, '../planning/store': { usePlanning: { getState: () => ({ data }) } } });
  const run = scoped('src/run/store.ts');
  const plan = run.planFor('2026-10-09'); assert.equal(plan.duration_min, 25);
  run.setPlanStatus(plan, 'completed');
  assert.equal(saved.status, 'completed'); assert.equal(run.planFor('2026-10-09').status, 'completed');
  assert.equal(plannedSessions(data, run.R.plans, '2026-10-09', '2026-10-09').length, 1);
  run.R.plans = [coachPlan({ id: '2026-10-06', plan_date: '2026-10-06' })];
  data.overrides = [{ id: 'coach:2026-10-06', originalDate: '2026-10-06', date: '2026-10-07' }];
  assert.equal(run.planFor('2026-10-07').workout_type, 'intervals');
});
test('unfamiliar equipment and CrossFit history cannot set future strength weights or machine records', () => {
  const scoped = loader({ '../db/docs': {}, '../state/store': {}, './seed': { DEFAULT_REP_RANGE: { min: 8, max: 12 } } });
  const store = scoped('src/strength/store.ts');
  const completed = (id, extra) => ({ id, startedAt: Date.now(), items: [{ exerciseId: 'press', sets: [{ type: 'normal', weight: 500, reps: 10, done: true }] }], ...extra });
  store.L.workouts = [completed('gym', { equipmentAdjusted: true }), completed('cf', { trainingKind: 'crossfit' }), completed('normal', { items: [{ exerciseId: 'press', sets: [{ type: 'normal', weight: 40, reps: 10, done: true }] }] })];
  assert.equal(store.lastPerformance('press').sets[0].weight, 40);
  assert.equal(store.exerciseBests('press').weight, 40);
  const coaching = loader({ './store': { workouts: () => store.L.workouts, setGroup: () => 'work' } })('src/strength/coach.ts');
  assert.deepEqual(coaching.sessions('press').map(s => s.workoutId), ['normal']);
});
test('saving a tailored workout preserves its source credit and type; strength goals exclude CrossFit', () => {
  const state = { active: null, settings: {}, workouts: [] }; let committed;
  const scoped = loader({ 'expo-notifications': {}, '../run/store': { R: { plans: [] } }, '../planning/store': { usePlanning: { getState: () => ({ data: { combinedProgram: hybrid() } }) } }, '../planning/model': {}, './coach': { deloadActive: () => false }, './store': { L: state, persist: { active: () => {} }, emit: () => {}, commitWorkout: value => { committed = value; state.workouts.push(value); } } });
  const workout = scoped('src/strength/workout.ts');
  const active = { id: 'cf', name: 'CF', startedAt: Date.now() - 600000, items: [{ exerciseId: 'squat', sets: [{ type: 'normal', weight: 10, reps: 10, done: true }] }], equipmentAdjusted: true, trainingKind: 'crossfit', plannedSessionId: 'weekly:cf:2026-10-06', adaptationNotes: 'Snapshot' };
  const record = workout.saveWorkout(active);
  assert.equal(record, committed); assert.equal(record.trainingKind, 'crossfit'); assert.equal(record.plannedSessionId, active.plannedSessionId);
  assert.equal(record.equipmentAdjusted, true); assert.deepEqual(record.prs, []);
  assert.equal(workout.workoutsThisWeek(), 0); assert.equal(workout.weeklyGoal(), 2);
});
test('fixed CrossFit classes stay on their chosen weekday and receive a visible recovery alternative', () => {
  const fixed = next({ kind: 'crossfit', fixedDay: true });
  const result = adaptSessions([fixed], context(), [])[0];
  assert.equal(result.date, fixed.date); assert.equal(result.adjustment.mode, 'reduce');
  assert.ok(result.adjustment.reason.includes('יום אימון קבוע')); assert.ok(result.adjustment.reason.includes('סבב טכני'));
  const data = emptyPlanning(); data.rules = [rule({ weekday: 2, kind: 'crossfit' })];
  assert.equal(plannedSessions(data, [], '2026-10-06', '2026-10-06')[0].fixedDay, true);
});
test('confirmed kettlebells and bands provide movement-matched alternatives without assuming a bench', () => {
  const source = [routineItem('Romanian Deadlift'), routineItem('Seated Cable Row')];
  const kettle = equipment.tailorWorkout(source, library, gym('kettlebell'), 'strength', 45);
  assert.deepEqual(kettle.rows.map(r => exNamed('Kettlebell Deadlift').id === r.exerciseId ? 'hinge' : exNamed('Kettlebell Row').id === r.exerciseId ? 'row' : 'unknown'), ['hinge','row']);
  const bands = equipment.tailorWorkout(source, library, gym('bands'), 'strength', 45);
  assert.equal(bands.rows.length, 2); assert.equal(bands.omitted.length, 0);
  assert.ok(bands.rows.every(r => r.item.sets.every(s => s.weight === '')));
});
test('CrossFit cardio and gym substitutions use logger minutes rather than the distance field', () => {
  const source = combined.crossfitItems(library, 'returning');
  const cardio = source.find(i => i.exerciseId === exNamed('Stationary Bike').id);
  assert.ok(cardio.sets.every(s => s.weight === 2 && s.reps === ''));
  const tailored = equipment.tailorWorkout(source, library, gym('dumbbells','bench','floor_space','bike'), 'crossfit', 30);
  const row = tailored.rows.find(i => i.exerciseId === cardio.exerciseId);
  assert.equal(row.item.sets[0].weight, 2); assert.equal(row.item.sets[0].reps, '');
  assert.ok(tailored.rows.every(r => r.item.superset === 'spontaneous-circuit'));
  const state = { active: null, exercises: library };
  const scoped = loader({ 'expo-notifications': {}, '../run/store': { R: { plans: [] } }, '../planning/store': {}, '../planning/model': {}, './coach': {}, './store': { L: state, persist: { active: () => {} }, emit: () => {} } });
  const workout = scoped('src/strength/workout.ts');
  workout.startSpontaneousWorkout({ title: 'CF', kind: 'crossfit', instructions: '', rows: tailored.rows });
  const live = state.active.items.find(i => i.exerciseId === cardio.exerciseId);
  assert.equal(live.sets[0].weight, 2); assert.equal(live.sets[0].reps, '');
  assert.ok(state.active.items.every(i => i.superset === 'spontaneous-circuit'));
});

test('experienced level: 3 strength + 2 runs is valid without CrossFit', () => {
  const p = hybrid({ level: 'advanced', slots: [...combined.ADVANCED_SLOTS] });
  assert.deepEqual(combined.validateProgram(p), []);
  assert.ok(combined.validateProgram(hybrid({ slots: [...combined.ADVANCED_SLOTS] })).length, 'CrossFit stays required below experienced');
});
test('experienced level keeps the running engine plan and fills empty run days', () => {
  const p = hybrid({ level: 'advanced', slots: [...combined.ADVANCED_SLOTS] });
  const quality = coachPlan(); // Monday 2026-10-05 is a run slot
  assert.equal(combined.combinedRunPlan(p, quality), quality);
  const filled = combined.combinedRunPlan(p, coachPlan({ workout_type: 'rest', duration_min: 0 }));
  assert.equal(filled.workout_type, 'easy'); assert.equal(filled.duration_min, 40);
  assert.equal(combined.combinedRunPlan(p, coachPlan({ plan_date: '2026-10-06' })).workout_type, 'rest', 'Tuesday is a strength day');
});
test('experienced routines are heavy compounds with blank starting weights', () => {
  for (let v = 0; v < 3; v++) {
    const items = combined.advancedItems(library, v);
    assert.ok(items.length >= 6);
    assert.ok(items[0].repMax <= 8 && items[0].sets.length >= 3);
    assert.ok(items.every(i => i.sets.every(s => s.weight === '')));
  }
});
