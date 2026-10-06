// Post-workout summary, ported from Lift's /summary/:id view.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Row, Screen, SectionTitle } from '../../../src/components/ui';
import { exerciseName, fmtW, unitLabel, useLiftVersion, workout, workoutSetCount, workoutVolume, workouts } from '../../../src/strength/store';
import { fmtCompact, fmtDate, fmtDuration, fmtNum, fmtTime, weekStart } from '../../../src/strength/utils';
import { canResume, resumeFinished, weekStreak, weeklyGoal } from '../../../src/strength/workout';
import { L } from '../../../src/strength/store';
import { colors, font, spacing } from '../../../src/theme';

export default function Summary() {
  useLiftVersion();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const router = useRouter();
  const w = workout(id);

  useEffect(() => {
    if (fresh) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [fresh]);

  if (!w) return null;
  const nth = workouts().filter((x) => x.startedAt <= w.startedAt).length;
  const prCount = (w.prs || []).length;
  const ws = weekStart(w.startedAt);
  const n = workouts().filter((x) => x.startedAt >= ws && x.startedAt < ws + 7 * 86_400_000).length;
  const goal = weeklyGoal();
  const streak = weekStreak();
  const goalText =
    n >= goal
      ? `${n === goal ? 'היעד השבועי הושג' : `${n} השבוע, מעל היעד`} — ${streak > 1 ? `רצף של ${streak} שבועות!` : 'רצף התחיל!'}`
      : `${n} מתוך ${goal} השבוע — עוד ${goal - n === 1 ? 'אימון אחד' : `${goal - n} אימונים`} ליעד`;

  return (
    <Screen>
      <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: prCount ? 'rgba(251,191,36,0.18)' : colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={prCount ? 'trophy' : 'checkmark'} size={38} color={prCount ? colors.pr : colors.success} />
        </View>
        <Text style={[font.label, { marginTop: spacing.md }]}>
          אימון #{nth}
          {prCount ? ` · ${prCount} שיאים` : ''}
        </Text>
        <Text style={[font.h1, { textAlign: 'center' }]}>{w.name}</Text>
        <Text style={font.small}>
          {fmtDate(w.startedAt, { weekday: 'long', month: 'short', day: 'numeric' })} · {fmtTime(w.startedAt)}
        </Text>
      </View>

      <Row style={{ gap: spacing.sm }}>
        <Box v={fmtDuration(w.durationSec)} k="משך" />
        <Box v={`${fmtCompact(fmtW(workoutVolume(w)))} ${unitLabel()}`} k="נפח" />
        <Box v={String(workoutSetCount(w))} k="סטים" />
      </Row>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="flame" size={18} color={colors.flame} />
        <Text style={[font.body, { fontWeight: '700', flex: 1 }]}>{goalText}</Text>
      </Card>

      {w.prs && w.prs.length ? (
        <>
          <SectionTitle>{w.prs.length} שיאים חדשים</SectionTitle>
          {w.prs.map((p, i) => (
            <Card key={i} style={{ paddingVertical: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={font.h3}>{exerciseName(p.exerciseId)}</Text>
                <Ionicons name="trophy" size={15} color={colors.pr} />
              </Row>
              <Text style={font.small}>חדש: {p.hits.join(' · ')}</Text>
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>תרגילים</SectionTitle>
      {w.items.map((it, i) => (
        <Card key={i} style={{ paddingVertical: 10 }}>
          <Text style={font.h3}>{exerciseName(it.exerciseId)}</Text>
          <Text style={[font.small, { marginTop: 4 }]}>
            {it.sets.map((s) => `${s.type === 'warmup' ? 'W ' : ''}${fmtNum(fmtW(s.weight))}×${fmtNum(s.reps)}`).join('   ')}
          </Text>
        </Card>
      ))}

      <Button title="סיום" onPress={() => router.dismissTo('/(tabs)/train')} style={{ marginTop: spacing.md }} />
      <Button title="להיסטוריה" variant="ghost" onPress={() => router.replace({ pathname: '/strength/history/[id]', params: { id: w.id } })} style={{ marginTop: spacing.sm }} />
      {canResume(w) ? (
        <Button
          title="לא סיימת? להמשיך את האימון"
          variant="ghost"
          icon={<Ionicons name="play" size={16} color={colors.text} />}
          onPress={() => {
            if (L.active) {
              Alert.alert('יש אימון פעיל', 'סיימו או בטלו אותו קודם.');
              return;
            }
            resumeFinished(w);
            router.replace('/strength/workout');
          }}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </Screen>
  );
}

function Box({ v, k }: { v: string; k: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <Text style={[font.h3, { writingDirection: 'ltr' }]}>{v}</Text>
      <Text style={font.tiny}>{k}</Text>
    </Card>
  );
}
