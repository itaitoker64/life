// Workout history with month calendar, ported from lift/js/views/history.js.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ExerciseThumb } from '../../src/components/strength';
import { Card, Empty, Row, Screen, SectionTitle } from '../../src/components/ui';
import { bestSet, exercise, exerciseName, fmtW, unitLabel, useLiftVersion, workoutSetCount, workoutVolume, workouts } from '../../src/strength/store';
import type { Workout } from '../../src/strength/types';
import { fmtCompact, fmtDuration, fmtNum, fmtTime, monthKey, monthLabel, relDay } from '../../src/strength/utils';
import { chevronBack, chevronForward, colors, font, radius, spacing } from '../../src/theme';

export default function History() {
  useLiftVersion();
  const router = useRouter();
  const list = workouts();
  const [cal, setCal] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });

  if (!list.length) {
    return (
      <Screen bottomInset={false}>
        <Empty text="עדיין אין אימונים. אימונים שהסתיימו יופיעו כאן עם כל הסטים." />
      </Screen>
    );
  }

  let lastMonth: string | null = null;
  return (
    <Screen bottomInset={false}>
      <Calendar month={cal} setMonth={setCal} list={list} onOpen={(id) => router.push({ pathname: '/strength/history/[id]', params: { id } })} />
      {list.map((w) => {
        const mk = monthKey(w.startedAt);
        const header =
          mk !== lastMonth ? (
            <SectionTitle right={<Text style={font.tiny}>{list.filter((x) => monthKey(x.startedAt) === mk).length} אימונים</Text>}>{monthLabel(mk)}</SectionTitle>
          ) : null;
        lastMonth = mk;
        return (
          <View key={w.id}>
            {header}
            <WorkoutCard w={w} onPress={() => router.push({ pathname: '/strength/history/[id]', params: { id: w.id } })} />
          </View>
        );
      })}
    </Screen>
  );
}

function Calendar({ month, setMonth, list, onOpen }: { month: number; setMonth: (t: number) => void; list: Workout[]; onOpen: (id: string) => void }) {
  const first = new Date(month);
  const y = first.getFullYear(), m = first.getMonth();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay(); // Sunday-first
  const byDay: Record<number, Workout[]> = {};
  let count = 0;
  for (const w of list) {
    const d = new Date(w.startedAt);
    if (d.getFullYear() === y && d.getMonth() === m) {
      (byDay[d.getDate()] = byDay[d.getDate()] || []).push(w);
      count++;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();
  const isCurrent = now.getFullYear() === y && now.getMonth() === m;
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Pressable onPress={() => setMonth(new Date(y, m - 1, 1).getTime())} hitSlop={8} style={{ padding: 6 }}>
          <Ionicons name={chevronBack} size={20} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={font.h3}>{monthLabel(monthKey(month))}</Text>
          <Text style={font.tiny}>{count} אימונים</Text>
        </View>
        <Pressable disabled={isCurrent} onPress={() => setMonth(new Date(y, m + 1, 1).getTime())} hitSlop={8} style={{ padding: 6, opacity: isCurrent ? 0.3 : 1 }}>
          <Ionicons name={chevronForward} size={20} color={colors.text} />
        </Pressable>
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((d) => (
          <Text key={d} style={[font.tiny, { width: `${100 / 7}%`, textAlign: 'center', marginBottom: 4 }]}>
            {d}
          </Text>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const t = new Date(y, m, day).getTime();
          const ws = byDay[day];
          const isToday = t === today.getTime();
          return (
            <Pressable key={day} disabled={!ws} onPress={() => ws && onOpen(ws[0].id)} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: ws ? colors.primary : 'transparent',
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: colors.primary,
                }}
              >
                <Text style={{ color: ws ? '#fff' : t > today.getTime() ? colors.faint : colors.text, fontWeight: '700', fontSize: 13 }}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export function WorkoutCard({ w, onPress }: { w: Workout; onPress: () => void }) {
  const prs = (w.prs || []).length;
  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={font.h3}>{w.name}</Text>
            <Text style={font.tiny}>
              {relDay(w.startedAt)} · {fmtTime(w.startedAt)}
            </Text>
          </View>
          <Ionicons name={chevronForward} size={18} color={colors.faint} />
        </Row>
        <Row style={{ gap: spacing.lg, marginTop: spacing.sm }}>
          <Stat k="זמן" v={fmtDuration(w.durationSec)} />
          <Stat k="נפח" v={`${fmtCompact(fmtW(workoutVolume(w)))} ${unitLabel()}`} />
          <Stat k="סטים" v={String(workoutSetCount(w))} />
          {prs ? <Stat k="שיאים" v={`🏆 ${prs}`} /> : null}
        </Row>
        <View style={{ marginTop: spacing.sm, gap: 4 }}>
          {w.items.slice(0, 4).map((it, i) => {
            const best = bestSet(it);
            const n = it.sets.filter((s) => s.type !== 'warmup').length;
            return (
              <Row key={i} style={{ gap: spacing.sm }}>
                <ExerciseThumb ex={exercise(it.exerciseId)} size={26} />
                <Text style={[font.small, { flex: 1, color: colors.text }]} numberOfLines={1}>
                  {n} × {exerciseName(it.exerciseId)}
                </Text>
                {best ? (
                  <Text style={[font.tiny, { writingDirection: 'ltr' }]}>
                    {fmtNum(fmtW(best.weight))} × {best.reps}
                  </Text>
                ) : null}
              </Row>
            );
          })}
          {w.items.length > 4 ? <Text style={font.tiny}>ועוד {w.items.length - 4} תרגילים</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <View>
      <Text style={font.tiny}>{k}</Text>
      <Text style={[font.body, { fontWeight: '700' }]}>{v}</Text>
    </View>
  );
}
