// Live workout screen, ported from lift/js/views/workout.js.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, Vibration, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, Sheet, toast } from '../../src/components/sheet';
import { DurationSheet, ExercisePicker, ExerciseThumb, NumCell, RepRangeSheet, SetBadge } from '../../src/components/strength';
import { Button, Row } from '../../src/components/ui';
import {
  EFFORTS,
  alternatives,
  calibrate,
  deloadActive,
  fatigue,
  progressionPlan,
  recordCalibration,
  trend,
} from '../../src/strength/coach';
import { muscleTarget, muscleHe } from '../../src/strength/seed';
import {
  L,
  defaultRepRange,
  emit,
  exercise,
  exerciseName,
  fmtW,
  lastPerformance,
  persistActiveSoon,
  routine,
  setGroup,
  unitLabel,
  updateExercise,
  useLiftVersion,
  weeklyMuscleSets,
} from '../../src/strength/store';
import type { ActiveWorkout, LiveItem, LiveSet } from '../../src/strength/types';
import { DAY, fmtClock, fmtNum, weekStart } from '../../src/strength/utils';
import {
  SET_TYPES,
  applyTarget,
  assignFailureChecks,
  autoWarmups,
  bumpRest,
  checkPR,
  defaultName,
  elapsedSec,
  endActive,
  ensureNotificationPermission,
  newItem,
  routineDiff,
  saveWorkout,
  setsFromLast,
  ss,
  startRest,
  stopRest,
  supersetNext,
  updateRoutineFromWorkout,
  warmupCount,
} from '../../src/strength/workout';
import { chevronForward, colors, font, radius, spacing } from '../../src/theme';

function touch() {
  persistActiveSoon();
  emit();
}

export default function WorkoutScreen() {
  useLiftVersion();
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const a = L.active;
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<number, number>>({});
  const [, setTick] = useState(0);
  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'replace'; item: LiveItem }>(null);
  const [finishSheet, setFinishSheet] = useState<string[] | null>(null);
  const [failMsg, setFailMsg] = useState<{ title: string; text: string } | null>(null);
  const [nameDraft, setNameDraft] = useState(a?.name ?? '');

  useEffect(() => {
    if (!a) {
      router.back();
      return;
    }
    assignFailureChecks(a);
    ensureNotificationPermission();
  }, []);

  // Clock + rest countdown. When the rest ends while the screen is open, buzz (once).
  useEffect(() => {
    const t = setInterval(() => {
      const cur = L.active;
      if (cur?.rest && Date.now() >= cur.rest.endsAt) {
        if (Date.now() - cur.rest.endsAt < 3000) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Vibration.vibrate([0, 200, 100, 200]);
        }
        cur.rest = null;
        touch();
      }
      setTick((n) => n + 1);
    }, 500);
    return () => clearInterval(t);
  }, []);

  if (!a) return null;

  function focusItem(item: LiveItem) {
    const y = cardY.current[a!.items.indexOf(item)];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
  }

  function finish() {
    const doneSets = a!.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
    if (doneSets === 0) {
      Alert.alert('לסיים בלי סטים?', 'אף סט לא סומן כהושלם, כך שלא יישמר שום דבר משמעותי.', [
        { text: 'להמשיך באימון', style: 'cancel' },
        {
          text: 'למחוק את האימון',
          style: 'destructive',
          onPress: () => {
            endActive();
            router.back();
          },
        },
      ]);
      return;
    }
    const total = a!.items.reduce((n, it) => n + it.sets.length, 0);
    const pending = total - doneSets;
    if (pending > 0) {
      const working = a!.items.flatMap((it) => it.sets.filter((s) => s.type !== 'warmup'));
      const partial = working.filter((s) => s.done).length < working.length / 2;
      Alert.alert(
        `${pending} סטים לא סומנו`,
        partial
          ? 'בוצעו פחות ממחצית סטי העבודה. האימון יישמר בהיסטוריה, אבל לא ייחשב כהשלמת האימון המתוכנן — הוא יישאר פתוח.'
          : 'סטים שלא סומנו לא יישמרו. לסיים את האימון?',
        [
          { text: 'להמשיך באימון', style: 'cancel' },
          { text: 'לסיים', onPress: () => proceedFinish(partial) },
        ],
      );
      return;
    }
    proceedFinish(false);
  }

  function proceedFinish(partial: boolean) {
    a!.partial = partial || undefined;
    const r = a!.routineId ? routine(a!.routineId) : null;
    // A partial session must not reshape the routine.
    const changes = r && !partial && !a!.equipmentAdjusted && !a!.adaptationDeload ? routineDiff(r, a!.items) : [];
    if (!changes.length) return commit();
    setFinishSheet(changes);
  }

  function commit() {
    const record = saveWorkout(a!);
    router.replace({ pathname: '/strength/summary/[id]', params: { id: record.id, fresh: '1' } });
  }

  function cancelWorkout() {
    Alert.alert('לבטל את האימון?', 'שום דבר לא יישמר בהיסטוריה.', [
      { text: 'להמשיך באימון', style: 'cancel' },
      {
        text: 'לבטל אימון',
        style: 'destructive',
        onPress: () => {
          endActive();
          router.back();
        },
      },
    ]);
  }

  const restLeft = a.rest ? Math.max(0, (a.rest.endsAt - Date.now()) / 1000) : 0;
  const routineName = a.routineId ? routine(a.routineId)?.name : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      {/* header */}
      <Row style={{ paddingHorizontal: spacing.sm, paddingVertical: 6, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 8 }} accessibilityLabel="מזעור">
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            onBlur={() => {
              a.name = nameDraft.trim() || defaultName();
              setNameDraft(a.name);
              touch();
            }}
            style={{ color: colors.text, fontSize: 17, fontWeight: '800', paddingVertical: 2 }}
          />
          <Text style={[font.tiny, { color: colors.primary, fontWeight: '700' }]}>{fmtClock(elapsedSec(a))}</Text>
        </View>
        <Button title="סיום" variant="good" size="sm" onPress={finish} />
      </Row>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.md, paddingBottom: (a.rest ? 140 : 60) + insets.bottom }} keyboardShouldPersistTaps="handled">
        {deloadActive() ? (
          <View style={{ padding: 10, borderRadius: radius.md, backgroundColor: colors.primarySoft, marginBottom: spacing.md }}>
            <Text style={[font.small, { color: colors.text }]}>שבוע דילואוד: אותם משקלים, חצי מהסטים, לעצור כשנשארות 3–4 חזרות.</Text>
          </View>
        ) : null}
        {a.equipmentAdjusted ? <Text style={[font.small, { marginBottom: spacing.md }]}>ציוד מזדמן: בחרו משקלים מחדש אחרי חימום. האימון הזה לא משנה את הרוטינה או את יעדי המשקל במקום הקבוע.</Text> : null}
        {!a.items.length ? <Text style={[font.small, { textAlign: 'center', padding: 30 }]}>אין עדיין תרגילים. הוסיפו את הראשון למטה.</Text> : null}
        {a.items.map((it, idx) => (
          <View key={`${it.exerciseId}-${idx}`} onLayout={(e) => (cardY.current[idx] = e.nativeEvent.layout.y)}>
            <ExerciseCard
              a={a}
              it={it}
              idx={idx}
              onReplace={() => setPicker({ mode: 'replace', item: it })}
              onFocusNext={(next) => setTimeout(() => focusItem(next), 80)}
              onFailResult={setFailMsg}
              onOpenExercise={() => router.push({ pathname: '/strength/exercise/[id]', params: { id: it.exerciseId } })}
            />
          </View>
        ))}

        <Pressable
          onPress={() => setPicker({ mode: 'add' })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 46,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
          }}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>הוספת תרגיל</Text>
        </Pressable>
        <Button title="ביטול האימון" variant="ghost" onPress={cancelWorkout} style={{ marginTop: spacing.lg }} />
        {routineName ? <Text style={[font.tiny, { textAlign: 'center' }]}>מתוך הרוטינה {routineName}</Text> : null}
      </ScrollView>

      {/* rest dock */}
      {a.rest ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 18 + insets.bottom }}>
          <View style={{ height: 3, backgroundColor: colors.elev2 }}>
            <View style={{ height: 3, width: `${Math.min(100, (restLeft / a.rest.duration) * 100)}%`, backgroundColor: colors.primary }} />
          </View>
          <Row style={{ paddingHorizontal: spacing.lg, paddingTop: 10, gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={font.tiny}>מנוחה</Text>
              <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900' }}>{fmtClock(Math.ceil(restLeft))}</Text>
            </View>
            <DockBtn label="−15" onPress={() => (bumpRest(a, -15), emit())} />
            <DockBtn label="+15" onPress={() => (bumpRest(a, 15), emit())} />
            <DockBtn label="דילוג" primary onPress={() => (stopRest(a), emit())} />
          </Row>
        </View>
      ) : null}

      <ExercisePicker
        visible={!!picker}
        single={picker?.mode === 'replace'}
        onClose={() => setPicker(null)}
        onDone={(ids) => {
          if (picker?.mode === 'replace') {
            const item = picker.item;
            item.exerciseId = ids[0];
            const rr = defaultRepRange(ids[0]);
            item.repMin = rr.min;
            item.repMax = rr.max;
            item.sets.forEach((s) => {
              if (!s.done) {
                s.weight = '';
                s.reps = '';
              }
            });
            if (!a.equipmentAdjusted) applyTarget(item, a.id);
          } else {
            for (const id of ids) {
              const item = newItem(id, { sets: a.equipmentAdjusted ? [{ type: 'normal', weight: '', reps: 10, done: false }] : setsFromLast(id) });
              if (a.equipmentAdjusted) item.sets = [{ type: 'normal', weight: '', reps: 10, done: false }];
              a.items.push(item);
            }
          }
          touch();
        }}
      />

      <Sheet
        visible={!!finishSheet}
        onClose={() => {
          setFinishSheet(null);
          toast('עדיין באימון');
        }}
        title={`לעדכן את "${routineName ?? ''}"?`}
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button
              title="לעדכן את הרוטינה"
              onPress={() => {
                updateRoutineFromWorkout(a);
                setFinishSheet(null);
                commit();
              }}
            />
            <Button
              title="להשאיר את הרוטינה המקורית"
              variant="ghost"
              onPress={() => {
                setFinishSheet(null);
                commit();
              }}
            />
          </View>
        }
      >
        <Text style={[font.small, { marginBottom: spacing.sm }]}>שינית את האימון לעומת הרוטינה:</Text>
        {(finishSheet ?? []).slice(0, 12).map((c, i) => (
          <Text key={i} style={[font.body, { marginBottom: 4 }]}>
            • {c}
          </Text>
        ))}
        {(finishSheet?.length ?? 0) > 12 ? <Text style={font.tiny}>ועוד {finishSheet!.length - 12}</Text> : null}
        <Text style={[font.tiny, { marginTop: spacing.sm }]}>בכל מקרה האימון נשמר בהיסטוריה.</Text>
      </Sheet>

      <Sheet visible={!!failMsg} onClose={() => setFailMsg(null)} title={failMsg?.title} footer={<Button title="הבנתי" onPress={() => setFailMsg(null)} />}>
        <Text style={[font.body, { lineHeight: 22 }]}>{failMsg?.text}</Text>
      </Sheet>
    </SafeAreaView>
  );
}

function DockBtn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 58,
        height: 44,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        backgroundColor: primary ? colors.primary : pressed ? colors.border : colors.elev2,
      })}
    >
      <Text style={{ color: primary ? '#fff' : colors.text, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- exercise card

function ExerciseCard({
  a,
  it,
  idx,
  onReplace,
  onFocusNext,
  onFailResult,
  onOpenExercise,
}: {
  a: ActiveWorkout;
  it: LiveItem;
  idx: number;
  onReplace: () => void;
  onFocusNext: (next: LiveItem) => void;
  onFailResult: (m: { title: string; text: string }) => void;
  onOpenExercise: () => void;
}) {
  const ex = exercise(it.exerciseId);
  const isCardio = ex?.tracking === 'cardio';
  const last = a.equipmentAdjusted ? null : lastPerformance(it.exerciseId, a.id);
  const [menu, setMenu] = useState(false);
  const [ssMenu, setSsMenu] = useState(false);
  const [restSheet, setRestSheet] = useState(false);
  const [rangeSheet, setRangeSheet] = useState(false);
  const [stallSheet, setStallSheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const complete = it.sets.length > 0 && it.sets.every((s) => s.done);
  const ssColor = it.superset ? ss.color(a.items, it) : null;
  const members = ss.members(a.items, it);

  if (!isCardio && !it.repMin) {
    const rr = defaultRepRange(it.exerciseId);
    it.repMin = rr.min;
    it.repMax = rr.max;
  }

  function prevFor(si: number): LiveSet | null {
    if (!last) return null;
    const g = setGroup(it.sets[si].type);
    let pos = 0;
    for (let i = 0; i < si; i++) if (setGroup(it.sets[i].type) === g) pos++;
    const same = last.sets.filter((s) => setGroup(s.type) === g);
    return (same[pos] as unknown as LiveSet) ?? null;
  }

  function lastWorkingIdx() {
    for (let i = it.sets.length - 1; i >= 0; i--) if (setGroup(it.sets[i].type) === 'work') return i;
    return -1;
  }

  function defaultEffort(si: number) {
    if (deloadActive()) return 'easy' as const;
    if (it._failCheck === true && si === lastWorkingIdx()) return 'fail' as const;
    return 'good' as const;
  }

  function toggleDone(si: number) {
    const st = it.sets[si];
    st.done = !st.done;
    st._pr = null;
    if (st.done) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const p = prevFor(si);
      if ((st.weight === '' || st.weight == null) && p) st.weight = p.weight;
      if ((st.reps === '' || st.reps == null) && p) st.reps = p.reps;
      if (st.type !== 'warmup') {
        const pr = checkPR(a, it.exerciseId, st);
        if (pr) {
          st._pr = pr;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
      if (setGroup(st.type) === 'work') {
        if (!st.effort) st.effort = defaultEffort(si);
        it._effortIdx = si;
        if (it._failCheck === true && si === lastWorkingIdx()) finishFailureCheck(si);
      }
      const next = supersetNext(a, it);
      if (next) {
        if (a.rest) stopRest(a);
        toast(`הבא: ${exerciseName(next.exerciseId)}`);
        onFocusNext(next);
      } else if (it.restSec) {
        startRest(a, st.type === 'warmup' ? Math.min(it.restSec, 60) : it.restSec);
      }
    } else if (it._effortIdx === si) {
      it._effortIdx = null;
    }
    touch();
  }

  function finishFailureCheck(si: number) {
    it._failCheck = 'done';
    const res = calibrate(it.sets, si);
    if (!res) return;
    recordCalibration(it.exerciseId, res);
    const word = res.said === 'easy' ? 'קל' : 'טוב';
    const text =
      res.gap >= 2
        ? `הגעת ל-${res.failReps} חזרות עד כשל — ${res.gap} יותר ממה שהסט ה"${word}" רמז. הסטים הרגילים שלך כנראה רחוקים מכשל יותר ממה שמרגיש: תדחפו עוד 1–2 חזרות.`
        : res.gap <= -2
          ? `הגעת ל-${res.failReps} חזרות עד כשל — פחות מהצפוי. הסטים שלך כבר קשים; "טוב" אצלך זה כנראה 0–1 בטנק. תמשיכו כך.`
          : `הגעת ל-${res.failReps} חזרות עד כשל — בדיוק מה שהסט ה"${word}" חזה. ההערכות שלך מדויקות.`;
    onFailResult({ title: `בדיקת כשל · ${exerciseName(it.exerciseId)}`, text });
  }

  function removeSet(si: number) {
    const removed = it.sets.splice(si, 1)[0];
    if (it._effortIdx === si) it._effortIdx = null;
    else if (it._effortIdx != null && it._effortIdx > si) it._effortIdx--;
    touch();
    toast('הסט הוסר', {
      action: {
        label: 'ביטול',
        onPress: () => {
          it.sets.splice(si, 0, removed);
          touch();
        },
      },
    });
  }

  function addSet() {
    const p = it.sets[it.sets.length - 1];
    it.sets.push({ type: 'normal', weight: p ? p.weight : '', reps: p ? p.reps : '', done: false });
    touch();
  }

  function addWarmups() {
    const work = it.sets.find((s) => setGroup(s.type) === 'work' && Number(s.weight) > 0);
    if (!work) {
      toast('הזינו קודם את משקל העבודה');
      return;
    }
    const n = warmupCount(Number(work.weight));
    const at = Math.max(0, it.sets.findIndex((s) => !s.done));
    for (let k = 0; k < n; k++) it.sets.splice(at, 0, { type: 'warmup', weight: '', reps: '', done: false });
    autoWarmups(it);
    touch();
    toast(`${n} סטי חימום נוספו, עד ${fmtNum(fmtW(work.weight))} ${unitLabel()}`);
  }

  function move(to: number) {
    const t = a.items[idx];
    a.items[idx] = a.items[to];
    a.items[to] = t;
    ss.tidy(a.items);
    touch();
  }

  function removeExercise() {
    const before = a.items.slice();
    a.items.splice(idx, 1);
    ss.tidy(a.items);
    touch();
    toast(`${exerciseName(it.exerciseId)} הוסר`, {
      action: {
        label: 'ביטול',
        onPress: () => {
          a.items.length = 0;
          a.items.push(...before);
          touch();
        },
      },
    });
  }

  const hasWarm = it.sets.some((s) => s.type === 'warmup');
  const tr = !isCardio && !a.equipmentAdjusted && a.trainingKind !== 'crossfit' && !deloadActive() ? trend(it.exerciseId) : null;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: complete ? 'rgba(34,197,94,0.45)' : colors.border,
        borderStartWidth: ssColor ? 4 : 1,
        borderStartColor: ssColor ?? (complete ? 'rgba(34,197,94,0.45)' : colors.border),
        padding: 12,
        marginBottom: spacing.md,
      }}
    >
      <Row style={{ gap: spacing.sm }}>
        <Pressable onPress={onOpenExercise}>
          <ExerciseThumb ex={ex} size={38} />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={onOpenExercise}>
          {it.superset ? <Text style={{ color: ssColor!, fontSize: 11, fontWeight: '800' }}>{a.trainingKind === 'crossfit' ? 'סבב קרוספיט' : ss.label(a.items, it)}</Text> : null}
          <Text style={[font.h3, { color: colors.primary }]} numberOfLines={2}>
            {ex ? exerciseName(ex.id) : 'תרגיל שנמחק'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setRestSheet(true)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4 }}>
          <Ionicons name="timer-outline" size={14} color={colors.muted} />
          <Text style={font.small}>{it.restSec ? fmtClock(it.restSec) : 'כבוי'}</Text>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} hitSlop={8} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
        </Pressable>
      </Row>

      {ex?.note ? (
        <Row style={{ gap: 6, marginTop: 8, padding: 8, borderRadius: radius.sm, backgroundColor: 'rgba(251,191,36,0.1)' }}>
          <Ionicons name="pin" size={13} color={colors.pr} />
          <Text style={[font.small, { color: colors.text, flex: 1 }]}>{ex.note}</Text>
        </Row>
      ) : null}

      {it.notes || it._showNote ? (
        <TextInput
          defaultValue={it.notes}
          onChangeText={(t) => {
            it.notes = t;
            persistActiveSoon();
          }}
          placeholder="הערה לאימון הזה…"
          placeholderTextColor={colors.faint}
          style={{ color: colors.text, backgroundColor: colors.elev2, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 }}
        />
      ) : null}

      {!isCardio ? <TargetRow a={a} it={it} onPress={() => setRangeSheet(true)} /> : null}

      {tr && tr.status === 'stalled' ? (
        <Pressable onPress={() => setStallSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, padding: 8, borderRadius: radius.sm, backgroundColor: colors.warningSoft }}>
          <Text>⚠</Text>
          <Text style={[font.small, { color: colors.warning, flex: 1 }]}>אין התקדמות ב-{tr.stalledFor} אימונים — לחצו לאפשרויות</Text>
          <Ionicons name={chevronForward} size={14} color={colors.warning} />
        </Pressable>
      ) : null}

      {it._failCheck === true && !isCardio ? (
        <View style={{ marginTop: 6, padding: 8, borderRadius: radius.sm, backgroundColor: colors.dangerSoft }}>
          <Text style={[font.small, { color: colors.text }]}>
            <Text style={{ fontWeight: '800' }}>בדיקת כשל · </Text>
            בסט האחרון, המשיכו עד שאי אפשר לעשות עוד חזרה נקייה. זה מראה כמה קשים באמת הסטים ה"טובים" שלכם.
          </Text>
        </View>
      ) : null}

      {/* set table */}
      <Row style={{ marginTop: 10, paddingHorizontal: 2 }}>
        <Text style={[font.tiny, { width: 36, textAlign: 'center' }]}>סט</Text>
        <Text style={[font.tiny, { flex: 1, textAlign: 'center' }]}>קודם</Text>
        <Text style={[font.tiny, { width: 70, textAlign: 'center' }]}>{isCardio ? 'דקות' : unitLabel()}</Text>
        <Text style={[font.tiny, { width: 58, textAlign: 'center' }]}>{isCardio ? 'ק״מ' : 'חזרות'}</Text>
        <View style={{ width: 44 }} />
      </Row>
      {it.sets.map((st, si) => {
        const p = prevFor(si);
        return (
          <View key={si}>
            <Row
              style={{
                paddingVertical: 4,
                paddingHorizontal: 2,
                borderRadius: radius.sm,
                backgroundColor: st.done ? 'rgba(34,197,94,0.12)' : 'transparent',
              }}
            >
              <View style={{ width: 36, alignItems: 'center' }}>
                <Pressable
                  onLongPress={() => removeSet(si)}
                  onPress={() => {
                    st.type = SET_TYPES[(SET_TYPES.indexOf(st.type) + 1) % SET_TYPES.length];
                    touch();
                  }}
                >
                  <SetBadge sets={it.sets} index={si} />
                </Pressable>
              </View>
              <Pressable
                style={{ flex: 1, alignItems: 'center' }}
                onPress={() => {
                  if (!p || st.done) return;
                  st.weight = p.weight;
                  st.reps = p.reps;
                  touch();
                }}
              >
                <Text style={[font.small, { writingDirection: 'ltr' }]}>{p ? `${fmtNum(fmtW(p.weight))}×${fmtNum(p.reps)}` : '—'}</Text>
              </Pressable>
              <View style={{ width: 70, alignItems: 'center' }}>
                <NumCell
                  value={st.weight}
                  isWeight={!isCardio}
                  done={st.done}
                  placeholder={p && p.weight !== '' ? fmtNum(isCardio ? p.weight : fmtW(p.weight)) : isCardio ? '' : unitLabel()}
                  onCommit={(v) => {
                    st.weight = v;
                    touch();
                  }}
                />
              </View>
              <View style={{ width: 58, alignItems: 'center' }}>
                <NumCell
                  value={st.reps}
                  isWeight={false}
                  done={st.done}
                  width={52}
                  placeholder={p && p.reps !== '' ? String(p.reps) : '—'}
                  onCommit={(v) => {
                    st.reps = v;
                    touch();
                  }}
                />
              </View>
              <Pressable
                onPress={() => toggleDone(si)}
                accessibilityLabel="סימון סט"
                style={{
                  width: 40,
                  height: 36,
                  marginStart: 4,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: st.done ? colors.success : colors.elev2,
                }}
              >
                <Ionicons name="checkmark" size={20} color={st.done ? '#05240f' : colors.faint} />
              </Pressable>
            </Row>
            {st.done && st._pr ? (
              <Row style={{ gap: 4, paddingStart: 40, paddingBottom: 2 }}>
                <Ionicons name="trophy" size={12} color={colors.pr} />
                <Text style={{ color: colors.pr, fontSize: 12, fontWeight: '700' }}>{st._pr}</Text>
              </Row>
            ) : null}
            {st.done && si === it._effortIdx && setGroup(st.type) === 'work' ? (
              <Row style={{ gap: 6, paddingVertical: 6, paddingHorizontal: 2 }}>
                <Text style={[font.tiny, { marginEnd: 2 }]}>כמה קשה?</Text>
                {EFFORTS.map((e) => {
                  const on = st.effort === e.key;
                  const c = e.key === 'easy' ? colors.success : e.key === 'good' ? colors.primary : colors.danger;
                  return (
                    <Pressable
                      key={e.key}
                      onPress={() => {
                        st.effort = e.key;
                        touch();
                      }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 5,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: on ? c : colors.border,
                        backgroundColor: on ? `${c}26` : 'transparent',
                      }}
                    >
                      <Text style={{ color: on ? colors.text : colors.muted, fontWeight: '700', fontSize: 13 }}>{e.label}</Text>
                      <Text style={{ color: colors.faint, fontSize: 10 }}>{e.sub}</Text>
                    </Pressable>
                  );
                })}
              </Row>
            ) : null}
          </View>
        );
      })}

      <Row style={{ gap: spacing.sm, marginTop: 8 }}>
        <Pressable onPress={addSet} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.elev2 }}>
          <Ionicons name="add" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>הוספת סט</Text>
        </Pressable>
        {!hasWarm && !isCardio ? (
          <Pressable onPress={addWarmups} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.warningSoft }}>
            <Ionicons name="flame-outline" size={16} color={colors.warning} />
            <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>חימום</Text>
          </Pressable>
        ) : null}
      </Row>
      <Text style={[font.tiny, { textAlign: 'center', marginTop: 4 }]}>הקשה על מספר הסט מחליפה סוג · לחיצה ארוכה מוחקת</Text>

      {/* sheets */}
      <Menu
        visible={menu}
        onClose={() => setMenu(false)}
        title={exerciseName(it.exerciseId)}
        items={[
          ex
            ? {
                label: ex.note ? 'עריכת הערה קבועה' : 'הערה קבועה (בכל פעם)',
                icon: 'pin-outline',
                onPress: () => {
                  setNoteDraft(ex.note ?? '');
                  setNoteSheet(true);
                },
              }
            : null,
          {
            label: it.notes || it._showNote ? 'הסתרת הערה' : 'הערה לאימון הזה',
            icon: 'document-text-outline',
            onPress: () => {
              it._showNote = !(it.notes || it._showNote);
              touch();
            },
          },
          { label: `טיימר מנוחה: ${it.restSec ? fmtClock(it.restSec) : 'כבוי'}`, icon: 'timer-outline', onPress: () => setRestSheet(true) },
          idx > 0 ? { label: 'להזיז למעלה', icon: 'arrow-up', onPress: () => move(idx - 1) } : null,
          idx < a.items.length - 1 ? { label: 'להזיז למטה', icon: 'arrow-down', onPress: () => move(idx + 1) } : null,
          it.superset
            ? { label: 'הוצאה מהסופרסט', icon: 'link-outline', onPress: () => (ss.unlink(a.items, it), touch()) }
            : a.items.length > 1
              ? { label: 'סופרסט עם…', icon: 'link-outline', onPress: () => setSsMenu(true) }
              : null,
          hasWarm || isCardio ? null : { label: 'הוספת סטי חימום', icon: 'flame-outline', onPress: addWarmups },
          { label: 'החלפת תרגיל', icon: 'swap-horizontal', onPress: onReplace },
          { label: 'הסרת התרגיל', icon: 'trash-outline', danger: true, onPress: removeExercise },
        ]}
      />
      <Menu
        visible={ssMenu}
        onClose={() => setSsMenu(false)}
        title={`סופרסט ${exerciseName(it.exerciseId)} עם`}
        items={a.items
          .filter((x) => x !== it && !members.includes(x))
          .map((x) => ({
            label: exerciseName(x.exerciseId) + (x.superset ? ` (${ss.label(a.items, x)})` : ''),
            onPress: () => {
              ss.link(a.items, it, x);
              touch();
            },
          }))}
      />
      <DurationSheet
        visible={restSheet}
        title={`מנוחה · ${exerciseName(it.exerciseId)}`}
        value={it.restSec || 0}
        onClose={() => setRestSheet(false)}
        onDone={(sec) => {
          it.restSec = sec;
          touch();
          if (sec > 0 && sec < 60) toast('מנוחה מתחת ל-60 שנ׳ עולה בחזרות בסטים הבאים — 90 שנ׳+ עדיף לצמיחה', { ms: 3500 });
        }}
      />
      <RepRangeSheet
        visible={rangeSheet}
        title={`טווח חזרות · ${exerciseName(it.exerciseId)}`}
        min={it.repMin}
        max={it.repMax}
        onClose={() => setRangeSheet(false)}
        onDone={(lo, hi) => {
          it.repMin = lo;
          it.repMax = hi;
          applyTarget(it, a.id);
          touch();
        }}
      />
      <Sheet visible={noteSheet} onClose={() => setNoteSheet(false)} title="הערה קבועה" footer={
        <Button
          title="שמירה"
          onPress={() => {
            if (ex) updateExercise(ex.id, { note: noteDraft.trim() || undefined });
            setNoteSheet(false);
          }}
        />
      }>
        <Text style={[font.small, { marginBottom: spacing.sm }]}>מוצגת בכל פעם שעושים את התרגיל — למשל כיוון מושב או אחיזה.</Text>
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          multiline
          placeholder="למשל: מושב בגובה 4"
          placeholderTextColor={colors.faint}
          style={{ color: colors.text, backgroundColor: colors.elev2, borderRadius: radius.md, padding: 12, minHeight: 80, textAlignVertical: 'top' }}
        />
      </Sheet>
      {stallSheet ? <StallSheet a={a} it={it} onClose={() => setStallSheet(false)} /> : null}
    </View>
  );
}

function TargetRow({ a, it, onPress }: { a: ActiveWorkout; it: LiveItem; onPress: () => void }) {
  const plan = a.equipmentAdjusted || a.trainingKind === 'crossfit' ? null : progressionPlan(it.exerciseId, it.repMin, it.repMax, a.id);
  let main: string;
  let why: string;
  if (!plan) {
    main = a.equipmentAdjusted ? 'ציוד אחר — בוחרים משקל מחדש' : a.trainingKind === 'crossfit' ? 'סבב טכני — בוחרים עומס נשלט' : 'פעם ראשונה — מוצאים את המשקל';
    why = `בחרו משקל שאפשר לעשות איתו ${it.repMin}–${it.repMax} חזרות ועוד 1–3 בטנק`;
  } else if (plan.counts.deload) {
    main = 'דילואוד: אותו משקל, חצי מהסטים';
    why = 'שבוע התאוששות — עוצרים כל סט כשנשארות 3–4 חזרות';
  } else {
    const work = plan.byType.work!;
    const shown = work.slice(0, 4).map((t) => `${fmtNum(fmtW(t.weight))}×${t.reps}`);
    main = `יעד (${unitLabel()}): ${shown.join(' · ')}${work.length > 4 ? ' …' : ''}`;
    const c = plan.counts;
    const easy = work.some((t) => t.kind === 'weight' && t.prevEffort === 'easy');
    const parts: string[] = [];
    if (c.weight) parts.push(easy ? 'יותר כבד — זה הרגיש קל' : `יותר כבד איפה שהגעת ל-${it.repMax}`);
    if (c.down) parts.push(`יותר קל איפה שירדת מתחת ל-${it.repMin}`);
    if (c.reps) parts.push(c.weight || c.down ? 'חזרה נוספת בשאר' : 'חזרה אחת יותר מהפעם הקודמת');
    why = parts.join('; ');
  }
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 8, borderRadius: radius.sm, backgroundColor: colors.primarySoft }}>
      <Ionicons name="locate-outline" size={16} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[font.small, { color: colors.text, fontWeight: '700', writingDirection: 'rtl' }]}>{main}</Text>
        {why ? <Text style={font.tiny}>{why}</Text> : null}
      </View>
      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.card }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
          {it.repMin}–{it.repMax}
        </Text>
      </View>
    </Pressable>
  );
}

function StallSheet({ a, it, onClose }: { a: ActiveWorkout; it: LiveItem; onClose: () => void }) {
  const ex = exercise(it.exerciseId)!;
  const T = muscleTarget(ex.primary);
  const lastWeek = weeklyMuscleSets(weekStart(Date.now() - 7 * DAY))[ex.primary] || 0;
  const altRange: [number, number] = it.repMax <= 10 ? [10, 15] : [6, 10];
  const alts = alternatives(it.exerciseId, a.items.map((x) => x.exerciseId), 3);
  const fat = fatigue();
  const under = lastWeek < T.min;
  const act = (fn: () => void) => () => {
    fn();
    touch();
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={`תקוע · ${exerciseName(ex.id)}`}>
      <Text style={[font.small, { marginBottom: spacing.md }]}>
        ה-1RM המשוער לא עלה ב-3 אימונים ויותר. נסו לפי הסדר — שאלת "לעדכן את הרוטינה?" בסוף האימון מאפשרת לשמור את השינוי.
      </Text>
      {fat.suggest ? (
        <View style={{ padding: 8, borderRadius: radius.sm, backgroundColor: colors.warningSoft, marginBottom: spacing.md }}>
          <Text style={[font.small, { color: colors.text }]}>יש גם סימני עייפות — שבוע דילואוד אולי יפתור את זה לבד.</Text>
        </View>
      ) : null}
      <Step n={1} title="בדיקת נפח" text={`${muscleHe(ex.primary)}: ${fmtNum(lastWeek)} סטים בשבוע שעבר (אזור ${T.min}–${T.max}). ${under ? 'מתחת למינימום — הוסיפו סט.' : 'בטווח — הנפח הוא לא הבעיה.'}`}>
        {under ? (
          <Button
            title="הוספת סט כאן"
            size="sm"
            variant="secondary"
            onPress={act(() => {
              const p = it.sets.filter((s) => setGroup(s.type) === 'work').pop();
              it.sets.push({ type: 'normal', weight: p?.weight ?? '', reps: p?.reps ?? '', done: false });
            })}
          />
        ) : null}
      </Step>
      <Step n={2} title="שינוי טווח החזרות" text="טווח חדש הוא גירוי חדש — גם משקל וגם חזרות בונים שריר כשהסטים קשים.">
        <Button
          title={`מעבר ל-${altRange[0]}–${altRange[1]} חזרות`}
          size="sm"
          variant="secondary"
          onPress={act(() => {
            it.repMin = altRange[0];
            it.repMax = altRange[1];
            applyTarget(it, a.id);
          })}
        />
      </Step>
      <Step n={3} title="החלפת תרגיל" text="אותו שריר, זווית אחרת. ↗ = עובד על השריר במתיחה, מה שנוטה להצמיח אותו יותר.">
        <View style={{ gap: 6 }}>
          {alts.map((x) => (
            <Button
              key={x.id}
              title={`${x.lengthened ? '↗ ' : ''}${exerciseName(x.id)}`}
              size="sm"
              variant="secondary"
              onPress={act(() => {
                it.exerciseId = x.id;
                const rr = defaultRepRange(x.id);
                it.repMin = rr.min;
                it.repMax = rr.max;
                it.sets.forEach((s) => {
                  if (!s.done) {
                    s.weight = '';
                    s.reps = '';
                  }
                });
                applyTarget(it, a.id);
              })}
            />
          ))}
        </View>
      </Step>
    </Sheet>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children?: React.ReactNode }) {
  return (
    <Row style={{ alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={font.h3}>{title}</Text>
        <Text style={font.small}>{text}</Text>
        {children}
      </View>
    </Row>
  );
}

