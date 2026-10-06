// Strength cards shared by Today and Train, ported from lift/js/views/home.js and coach.js.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { deloadActive, deloadDaysLeft, endDeload, fatigue, snoozeDeload, startDeload, summaryLine } from '../strength/coach';
import { GROWTH_MUSCLES, muscleHe, muscleTarget } from '../strength/seed';
import { usePlanning } from '../planning/store';
import { completedSessions, matchSessions, plannedSessions } from '../planning/model';
import { R } from '../run/store';
import { addDays, formatLongDate, today } from '../lib/dates';
import { L, exercise, weeklyMuscleSets } from '../strength/store';
import type { Routine } from '../strength/types';
import { fmtClock, fmtNum, relDay, weekStart } from '../strength/utils';
import {
  avgMinutes,
  elapsedSec,
  lastDone,
  nextRoutine,
  planLine,
  startFromRoutine,
  weekStreak,
  weeklyGoal,
} from '../strength/workout';
import { chevronForward, colors, font, gradient, radius, spacing } from '../theme';
import { ExerciseThumb } from './strength';
import { toast } from './sheet';
import { Button, Card, Pill, Row } from './ui';

/** Starts a workout, asking first if one is already in progress. */
export function useStartWorkout() {
  const router = useRouter();
  return (start: () => void) => {
    if (L.active) {
      Alert.alert('יש אימון פעיל', 'התחלת אימון חדש תמחק את האימון הנוכחי.', [
        { text: 'להמשיך את הנוכחי', onPress: () => router.push('/strength/workout') },
        {
          text: 'למחוק ולהתחיל',
          style: 'destructive',
          onPress: () => {
            start();
            router.push('/strength/workout');
          },
        },
      ]);
      return;
    }
    start();
    router.push('/strength/workout');
  };
}

/** "Up next" hero: the in-progress workout, the next routine in the rotation, or a first-time CTA. */
export function StrengthHero() {
  const data = usePlanning(s => s.data);
  const router = useRouter();
  const startWorkout = useStartWorkout();
  const [, setTick] = useState(0);
  const a = L.active;
  useEffect(() => {
    if (!a) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [a]);

  if (a) {
    const done = a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);
    const all = a.items.reduce((n, it) => n + it.sets.length, 0);
    return (
      <Hero kicker="אימון בתהליך" title={a.name || 'אימון'} sub={`${done} מתוך ${all} סטים · ${fmtClock(elapsedSec(a))}`}>
        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
          <View style={{ width: `${all ? (done / all) * 100 : 0}%`, height: '100%', backgroundColor: '#fff' }} />
        </View>
        <HeroButton icon="play" label="חזרה לאימון" onPress={() => router.push('/strength/workout')} />
      </Hero>
    );
  }
  // The planned calendar wins over plain rotation, so Train and Today agree on the next session.
  const plans = plannedSessions(data, R.plans, today(), addDays(today(), 7));
  const matches = matchSessions(plans, completedSessions(L.workouts, R.activities, data));
  const next = plans.find(p => p.kind === 'strength' && p.status !== 'skipped' && !matches.has(p.id) && L.routines.some(x => x.id === p.routineId));
  const r = next ? L.routines.find(x => x.id === next.routineId) : nextRoutine();
  if (!r) {
    return (
      <Hero kicker="מתחילים" title="בונים רוטינה ראשונה" sub="או מתחילים אימון ריק ומוסיפים תרגילים תוך כדי.">
        <HeroButton icon="add" label="רוטינה חדשה" onPress={() => router.push({ pathname: '/strength/routine/[id]', params: { id: 'new' } })} />
      </Hero>
    );
  }
  const last = lastDone(r.id);
  const mins = avgMinutes(r.id);
  const meta = [`${r.items.length} תרגילים`];
  if (next) meta.unshift(next.date === today() ? 'היום' : formatLongDate(next.date));
  if (mins) meta.push(`~${mins} דק׳`);
  if (last) meta.push(`לאחרונה ${relDay(last.startedAt)}`);
  const plan = planLine(r);
  return (
    <Hero kicker="האימון הבא" title={r.name} sub={meta.join(' · ')}>
      <Row style={{ gap: 6, marginTop: 10 }}>
        {r.items.slice(0, 5).map((it, i) => (
          <ExerciseThumb key={i} ex={exercise(it.exerciseId)} size={38} />
        ))}
        {r.items.length > 5 ? <Text style={{ color: '#fff', fontWeight: '700' }}>+{r.items.length - 5}</Text> : null}
      </Row>
      {plan ? (
        <Row style={{ gap: 6, marginTop: 10 }}>
          <Ionicons name="locate-outline" size={15} color="#fff" />
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 13, flex: 1 }}>{plan}</Text>
        </Row>
      ) : null}
      <HeroButton icon="play" label={`התחלת ${r.name}`} onPress={() => startWorkout(() => startFromRoutine(r.id))} />
    </Hero>
  );
}

function Hero({ kicker, title, sub, children }: { kicker: string; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <LinearGradient colors={gradient} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ borderRadius: radius.lg, padding: 16, marginBottom: spacing.md }}>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>{kicker}</Text>
      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2 }}>{title}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>{sub}</Text>
      {children}
    </LinearGradient>
  );
}

function HeroButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginTop: 14,
        minHeight: 46,
        borderRadius: radius.md,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color="#3a3fd8" />
      <Text style={{ color: '#2a2fb8', fontWeight: '800', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** Weekly goal ring + streak + this week's day strip. */
export function WeekGoalCard() {
  usePlanning(s => s.data);
  const ws = weekStart(Date.now());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = new Set<number>();
  for (const w of L.workouts) {
    if (w.startedAt < ws || w.trainingKind && w.trainingKind !== 'strength') continue;
    const d = new Date(w.startedAt);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  }
  const done = L.workouts.filter((w) => (!w.trainingKind || w.trainingKind === 'strength') && w.startedAt >= ws).length;
  const goal = weeklyGoal();
  const streak = weekStreak();
  const left = goal - done;
  const msg =
    left > 0
      ? `עוד ${left === 1 ? 'אימון אחד' : `${left} אימונים`} ליעד${streak ? ' ולשמירה על הרצף' : ''}`
      : done > goal
        ? `היעד נשבר — ${done - goal} אימונים מעבר השבוע`
        : 'היעד השבועי הושג';
  const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  return (
    <Card>
      <Row style={{ gap: spacing.md }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            borderWidth: 6,
            borderColor: done >= goal ? colors.success : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={font.h3}>
            {done}
            <Text style={font.tiny}>/{goal}</Text>
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={font.label}>אימוני כוח השבוע</Text>
          <Text style={[font.body, { fontWeight: '700' }]}>{msg}</Text>
          {streak ? (
            <Row style={{ gap: 4, marginTop: 2 }}>
              <Ionicons name="flame" size={14} color={colors.flame} />
              <Text style={{ color: colors.flame, fontSize: 12, fontWeight: '700' }}>רצף של {streak} שבועות</Text>
            </Row>
          ) : null}
        </View>
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(ws);
          d.setDate(d.getDate() + i);
          const t = d.getTime();
          const on = days.has(t);
          const isToday = t === today.getTime();
          return (
            <View key={i} style={{ alignItems: 'center', gap: 4 }}>
              <Text style={[font.tiny, isToday && { color: colors.primary, fontWeight: '700' }]}>{LETTERS[i]}</Text>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? colors.primary : colors.elev2,
                  borderWidth: isToday && !on ? 1.5 : 0,
                  borderColor: colors.primary,
                  opacity: t > today.getTime() ? 0.5 : 1,
                }}
              >
                {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{d.getDate()}</Text>}
              </View>
            </View>
          );
        })}
      </Row>
    </Card>
  );
}

/** Deload banner (active) or fatigue suggestion. */
export function DeloadCard({ compact }: { compact?: boolean }) {
  if (deloadActive()) {
    return (
      <Card style={{ borderColor: colors.primary }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={font.h3}>שבוע דילואוד · נשארו {deloadDaysLeft()} ימים</Text>
          <Pressable onPress={endDeload} hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>לסיים</Text>
          </Pressable>
        </Row>
        <Text style={[font.small, { marginTop: 4 }]}>
          אותם משקלים, חצי מהסטים, לעצור כשנשארות 3–4 חזרות. האימונים הבאים מוכנים כך אוטומטית.
        </Text>
      </Card>
    );
  }
  const f = fatigue();
  if (!f.suggest || (compact && f.snoozed)) return null;
  return (
    <Card style={{ borderColor: colors.warning }}>
      <Text style={font.h3}>סימני עייפות — לקחת שבוע דילואוד?</Text>
      {f.reasons.map((r, i) => (
        <Text key={i} style={[font.small, { marginTop: 4 }]}>
          • {r}
        </Text>
      ))}
      <Text style={[font.tiny, { marginTop: 8, marginBottom: spacing.md }]}>
        שבוע עם חצי מהסטים באותם משקלים נותן לעייפות להתפוגג כדי שהביצועים יחזרו לעלות. זה לא יעלה לך בשריר.
      </Text>
      <Row style={{ gap: spacing.sm }}>
        <Button
          title="להתחיל דילואוד"
          style={{ flex: 1 }}
          onPress={() => {
            startDeload();
            toast('שבוע דילואוד התחיל');
          }}
        />
        <Button title="לא עכשיו" variant="ghost" style={{ flex: 1 }} onPress={snoozeDeload} />
      </Row>
    </Card>
  );
}

export function CoachLink() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/strength/coach')}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="locate-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={font.h3}>מאמן כוח</Text>
          <Text style={font.small} numberOfLines={2}>
            {summaryLine()}
          </Text>
        </View>
        <Ionicons name={chevronForward} size={18} color={colors.faint} />
      </Card>
    </Pressable>
  );
}

/** Muscles below their weekly minimum, most behind first. */
export function MuscleCard() {
  const router = useRouter();
  const cur = weeklyMuscleSets(weekStart(Date.now()));
  const low = GROWTH_MUSCLES.map((m) => [m, cur[m] || 0, muscleTarget(m).min] as const)
    .filter((p) => p[1] < p[2])
    .sort((a, b) => a[1] / a[2] - b[1] / b[2]);
  const onTarget = GROWTH_MUSCLES.length - low.length;
  return (
    <Pressable onPress={() => router.push('/strength/stats')}>
      <Card style={{ paddingVertical: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={font.h3}>שרירים השבוע</Text>
          <Text style={font.tiny}>
            {onTarget}/{GROWTH_MUSCLES.length} באזור הצמיחה
          </Text>
        </Row>
        {low.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {low.map((p) => (
              <Pill key={p[0]} text={`${muscleHe(p[0])} ${fmtNum(p[1])}/${p[2]}`} />
            ))}
          </View>
        ) : (
          <Text style={[font.small, { color: colors.success, marginTop: 6 }]}>כל השרירים בטווח הצמיחה.</Text>
        )}
      </Card>
    </Pressable>
  );
}

export function RoutineCard({ r, onMenu }: { r: Routine; onMenu: () => void }) {
  const startWorkout = useStartWorkout();
  const last = lastDone(r.id);
  const names = r.items.map((it) => exercise(it.exerciseId)).filter(Boolean);
  const sub = names.length
    ? names
        .slice(0, 3)
        .map((e) => e!.nameHe || e!.name)
        .join(', ') + (names.length > 3 ? ` ועוד ${names.length - 3}` : '')
    : 'אין תרגילים עדיין';
  const empty = r.items.length === 0;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12 }}>
      <Pressable style={{ flex: 1 }} disabled={empty} onPress={() => startWorkout(() => startFromRoutine(r.id))}>
        <Text style={font.h3}>{r.name}</Text>
        <Text style={font.small} numberOfLines={2}>
          {sub}
        </Text>
        {last ? <Text style={[font.tiny, { marginTop: 2 }]}>לאחרונה {relDay(last.startedAt)}</Text> : null}
      </Pressable>
      <Pressable
        disabled={empty}
        onPress={() => startWorkout(() => startFromRoutine(r.id))}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', opacity: empty ? 0.4 : 1 }}
      >
        <Ionicons name="play" size={18} color={colors.primary} />
      </Pressable>
      <Pressable onPress={onMenu} hitSlop={8} style={{ padding: 6 }}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
      </Pressable>
    </Card>
  );
}

