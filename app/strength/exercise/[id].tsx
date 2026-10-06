// Exercise detail: photo, bests, 1RM and volume charts, history (Lift's /exercise/:id).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, useWindowDimensions } from 'react-native';
import { BarChart, TrendChart } from '../../../src/components/charts';
import { ExerciseForm } from '../../../src/components/exerciseForm';
import { Menu, Sheet } from '../../../src/components/sheet';
import { Button, Card, Row, Screen, SectionTitle } from '../../../src/components/ui';
import { EXERCISE_IMAGES } from '../../../src/strength/images';
import { equipmentHe, muscleHe } from '../../../src/strength/seed';
import {
  deleteExercise,
  exercise,
  exerciseBests,
  exerciseName,
  exerciseSeries,
  exerciseUsedCount,
  fmtW,
  unitLabel,
  updateExercise,
  useLiftVersion,
  workouts,
} from '../../../src/strength/store';
import { fmtCompact, fmtDate, fmtNum, relDay } from '../../../src/strength/utils';
import { colors, font, radius, spacing } from '../../../src/theme';

export default function ExerciseDetail() {
  useLiftVersion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [note, setNote] = useState('');
  const ex = exercise(id);
  if (!ex) return null;
  const bests = exerciseBests(id);
  const series = exerciseSeries(id);
  const hist = workouts().filter((w) => (w.items || []).some((it) => it.exerciseId === id));
  const chartW = width - spacing.lg * 2 - 30;
  const img = ex.image ? EXERCISE_IMAGES[ex.image] : null;

  return (
    <Screen bottomInset={false}>
      <Stack.Screen
        options={{
          title: exerciseName(id),
          headerRight: () => (
            <Pressable onPress={() => setMenu(true)} hitSlop={10}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      {img ? <Image source={img} style={{ width: '100%', aspectRatio: 1.5, borderRadius: radius.lg, marginBottom: spacing.md, backgroundColor: '#fff' }} resizeMode="contain" /> : null}
      <Text style={[font.small, { marginBottom: spacing.sm }]}>
        {muscleHe(ex.primary)} · {equipmentHe(ex.equipment)}
        {ex.isCustom ? ' · מותאם' : ''}
        {ex.nameHe ? ` · ${ex.name}` : ''}
      </Text>
      <Pressable onPress={() => (setNote(ex.note ?? ''), setNoteSheet(true))}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ex.note ? 'rgba(251,191,36,0.08)' : colors.card }}>
          <Ionicons name="pin" size={15} color={ex.note ? colors.pr : colors.faint} />
          <Text style={[font.small, { flex: 1, color: ex.note ? colors.text : colors.muted }]}>{ex.note || 'הערה קבועה — מוצגת בכל פעם שעושים את התרגיל'}</Text>
        </Card>
      </Pressable>

      <Row style={{ gap: spacing.sm }}>
        <Box v={bests.e1rm ? fmtNum(fmtW(bests.e1rm)) : '—'} k={`1RM משוער (${unitLabel()})`} />
        <Box v={bests.weight ? fmtNum(fmtW(bests.weight)) : '—'} k={`סט כבד (${unitLabel()})`} />
        <Box v={bests.volume ? fmtCompact(fmtW(bests.volume)) : '—'} k={`אימון שיא (${unitLabel()})`} />
      </Row>

      {series.length ? (
        <>
          <SectionTitle>1RM משוער</SectionTitle>
          <Card>
            <TrendChart
              width={chartW}
              height={200}
              color={colors.primary}
              decimals={1}
              points={series.map((p) => ({ trend: fmtW(p.e1rm) }))}
              labels={series.map((p, i) => (i % Math.max(1, Math.ceil(series.length / 5)) === 0 ? fmtDate(p.t, { day: 'numeric', month: 'short' }) : ''))}
            />
          </Card>
          <SectionTitle>נפח לאימון</SectionTitle>
          <Card>
            <BarChart
              width={chartW}
              height={140}
              color={colors.accent2}
              values={series.slice(-14).map((p) => Math.round(fmtW(p.volume)))}
              labels={series.slice(-14).map((p, i) => (i % 3 === 0 ? fmtDate(p.t, { day: 'numeric', month: 'short' }) : ''))}
            />
          </Card>
        </>
      ) : null}

      <SectionTitle>היסטוריה</SectionTitle>
      {!hist.length ? <Text style={[font.small, { textAlign: 'center' }]}>עדיין אין סטים רשומים</Text> : null}
      {hist.map((w) => {
        const it = w.items.find((x) => x.exerciseId === id)!;
        const sets = it.sets.filter((s) => s.done);
        return (
          <Pressable key={w.id} onPress={() => router.push({ pathname: '/strength/history/[id]', params: { id: w.id } })}>
            <Card style={{ paddingVertical: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[font.body, { fontWeight: '700' }]}>{fmtDate(w.startedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                <Text style={font.tiny}>{relDay(w.startedAt)}</Text>
              </Row>
              <Text style={[font.small, { marginTop: 4 }]}>
                {sets.length ? sets.map((s) => `${fmtNum(fmtW(s.weight))}×${fmtNum(s.reps)}`).join('   ') : 'אין סטים שהושלמו'}
              </Text>
            </Card>
          </Pressable>
        );
      })}

      <Menu
        visible={menu}
        onClose={() => setMenu(false)}
        title={exerciseName(id)}
        items={[
          { label: 'עריכת תרגיל', icon: 'create-outline', onPress: () => setForm(true) },
          ex.isCustom
            ? {
                label: 'מחיקת תרגיל',
                icon: 'trash-outline',
                danger: true,
                onPress: () => {
                  const used = exerciseUsedCount(ex.id);
                  Alert.alert(`למחוק את "${exerciseName(ex.id)}"?`, used ? `מופיע ב-${used} אימונים. הם יישארו, אבל השם יוצג כתרגיל שנמחק.` : 'אי אפשר לבטל.', [
                    { text: 'ביטול', style: 'cancel' },
                    {
                      text: 'מחיקה',
                      style: 'destructive',
                      onPress: () => {
                        deleteExercise(ex.id);
                        router.back();
                      },
                    },
                  ]);
                },
              }
            : null,
        ]}
      />
      <ExerciseForm visible={form} existing={ex} onClose={() => setForm(false)} />
      <Sheet visible={noteSheet} onClose={() => setNoteSheet(false)} title="הערה קבועה" footer={<Button title="שמירה" onPress={() => (updateExercise(ex.id, { note: note.trim() || undefined }), setNoteSheet(false))} />}>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus
          placeholder="למשל: מושב בגובה 4, אחיזה רחבה"
          placeholderTextColor={colors.faint}
          style={{ color: colors.text, backgroundColor: colors.elev2, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top' }}
        />
      </Sheet>
    </Screen>
  );
}

function Box({ v, k }: { v: string; k: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 }}>
      <Text style={font.h2}>{v}</Text>
      <Text style={[font.tiny, { textAlign: 'center' }]}>{k}</Text>
    </Card>
  );
}

