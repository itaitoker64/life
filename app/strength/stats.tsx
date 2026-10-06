// Strength stats + body measurements, ported from lift/js/views/stats.js.
// Bodyweight lives in the nutrition weight log (one source for the whole app), so only tape
// measurements are tracked here.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { BarChart, TrendChart } from '../../src/components/charts';
import { Sheet, toast } from '../../src/components/sheet';
import { Button, Card, Chip, Field, Row, Screen, SectionTitle, Segmented, parseNum } from '../../src/components/ui';
import { GROWTH_MUSCLES, muscleHe, muscleTarget } from '../../src/strength/seed';
import {
  addMeasurement,
  deleteMeasurement,
  exerciseName,
  fmtW,
  measurements,
  recentPRs,
  unitLabel,
  useLiftVersion,
  weeklyMuscleSets,
  weeklyVolume,
  workoutSetCount,
  workoutStreakDays,
  workoutVolume,
  workouts,
} from '../../src/strength/store';
import { WEEK, fmtCompact, fmtDate, fmtDuration, fmtNum, relDay, weekStart } from '../../src/strength/utils';
import { chevronForward, colors, font, radius, spacing } from '../../src/theme';

const TAPE = [
  { key: 'waist', label: 'מותניים' },
  { key: 'chest', label: 'חזה' },
  { key: 'arm', label: 'זרוע' },
  { key: 'thigh', label: 'ירך' },
];

type Metric = 'volume' | 'sets' | 'workouts';

export default function Stats() {
  useLiftVersion();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<Metric>('volume');
  const [explain, setExplain] = useState(false);
  const [logSheet, setLogSheet] = useState(false);
  const weeks = weeklyVolume(12);
  const chartW = width - spacing.lg * 2 - 30;
  const prs = recentPRs(5);

  // This week vs the same point last week.
  const now = Date.now();
  const start = weekStart(now);
  const totals = (from: number, to: number) => {
    const t = { workouts: 0, sets: 0, volume: 0, seconds: 0 };
    for (const w of workouts()) {
      if (w.startedAt < from || w.startedAt >= to) continue;
      t.workouts++;
      t.sets += workoutSetCount(w);
      t.volume += workoutVolume(w);
      t.seconds += w.durationSec || 0;
    }
    return t;
  };
  const cur = totals(start, now + 1);
  const prev = totals(start - WEEK, now - WEEK);

  const ws = workouts();
  const allVol = ws.reduce((n, w) => n + workoutVolume(w), 0);
  const avg = ws.length ? ws.reduce((n, w) => n + (w.durationSec || 0), 0) / ws.length : 0;

  return (
    <Screen bottomInset={false}>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={font.h3}>השבוע</Text>
          <Text style={font.tiny}>לעומת אותה נקודה בשבוע שעבר</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Delta k="אימונים" v={String(cur.workouts)} a={cur.workouts} b={prev.workouts} />
          <Delta k="סטים" v={String(cur.sets)} a={cur.sets} b={prev.sets} />
          <Delta k="נפח" v={`${fmtCompact(fmtW(cur.volume))}`} a={cur.volume} b={prev.volume} />
          <Delta k="זמן" v={cur.seconds ? fmtDuration(cur.seconds) : '0'} a={cur.seconds} b={prev.seconds} />
        </Row>
      </Card>

      <MuscleVolume onInfo={() => setExplain(true)} />

      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={font.h3}>12 שבועות אחרונים</Text>
        </Row>
        <Segmented<Metric>
          options={[
            { value: 'volume', label: `נפח (${unitLabel()})` },
            { value: 'sets', label: 'סטים' },
            { value: 'workouts', label: 'אימונים' },
          ]}
          value={metric}
          onChange={setMetric}
        />
        <BarChart
          width={chartW}
          height={140}
          color={colors.primary}
          values={weeks.map((p) => (metric === 'volume' ? Math.round(fmtW(p.volume)) : metric === 'sets' ? p.sets : p.workouts))}
          labels={weeks.map((p, i) => (i % 3 === 0 ? fmtDate(p.t, { day: 'numeric', month: 'short' }) : ''))}
        />
      </Card>

      {prs.length ? (
        <Card>
          <Text style={[font.h3, { marginBottom: 4 }]}>שיאים אחרונים</Text>
          {prs.map((p, i) => (
            <Pressable key={i} onPress={() => router.push({ pathname: '/strength/history/[id]', params: { id: p.workoutId } })}>
              <Row style={{ gap: spacing.sm, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Ionicons name="trophy" size={15} color={colors.pr} />
                <View style={{ flex: 1 }}>
                  <Text style={font.body}>{exerciseName(p.exerciseId)}</Text>
                  <Text style={font.tiny}>חדש: {p.hits.join(' · ')}</Text>
                </View>
                <Text style={font.tiny}>{relDay(p.t)}</Text>
              </Row>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={[font.h3, { marginBottom: spacing.sm }]}>מאז ומעולם</Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Mini k="אימונים" v={String(ws.length)} />
          <Mini k="נפח" v={`${fmtCompact(fmtW(allVol))}`} />
          <Mini k="אורך ממוצע" v={ws.length ? fmtDuration(avg) : '—'} />
          <Mini k="רצף ימים" v={String(workoutStreakDays())} />
        </Row>
      </Card>

      <SectionTitle
        right={
          <Pressable onPress={() => setLogSheet(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>רישום</Text>
          </Pressable>
        }
      >
        מדידות גוף
      </SectionTitle>
      <Pressable onPress={() => router.push('/weight')}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="scale-outline" size={20} color={colors.weight} />
          <Text style={[font.body, { flex: 1 }]}>משקל גוף — ביומן המשקל</Text>
          <Ionicons name={chevronForward} size={18} color={colors.faint} />
        </Card>
      </Pressable>
      {TAPE.map((mt) => {
        const series = measurements(mt.key);
        if (!series.length) return null;
        const latest = series[series.length - 1];
        const first = series[0];
        const change = latest.value - first.value;
        return (
          <Card key={mt.key}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={font.tiny}>{mt.label}</Text>
                <Text style={font.h2}>{fmtNum(latest.value)} ס״מ</Text>
              </View>
              {series.length > 1 ? (
                <Text style={font.tiny}>
                  {change > 0 ? '+' : ''}
                  {fmtNum(Math.round(change * 10) / 10)} ס״מ מאז {fmtDate(first.date, { day: 'numeric', month: 'short' })}
                </Text>
              ) : null}
            </Row>
            {series.length > 1 ? <TrendChart compact width={chartW} height={70} color={colors.accent2} points={series.map((p) => ({ trend: p.value }))} /> : null}
            <Pressable onPress={() => deleteMeasurement(latest.id)} hitSlop={6}>
              <Text style={[font.tiny, { marginTop: 6 }]}>מחיקת הרישום האחרון</Text>
            </Pressable>
          </Card>
        );
      })}
      {!TAPE.some((t) => measurements(t.key).length) ? (
        <Card>
          <Text style={[font.small, { textAlign: 'center' }]}>מדדו מותניים, חזה, זרוע וירך כדי לראות אם המשקל והמידות זזים בכיוון הנכון.</Text>
        </Card>
      ) : null}

      <ExplainSheet visible={explain} onClose={() => setExplain(false)} />
      <LogSheet visible={logSheet} onClose={() => setLogSheet(false)} />
    </Screen>
  );
}

function Delta({ k, v, a, b }: { k: string; v: string; a: number; b: number }) {
  const pct = b ? Math.round(((a - b) / b) * 100) : 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={font.tiny}>{k}</Text>
      <Text style={font.h3}>{v}</Text>
      <Text style={{ fontSize: 11, fontWeight: '700', color: pct > 0 ? colors.success : pct < 0 ? colors.danger : 'transparent' }}>
        {pct ? `${pct > 0 ? '▲' : '▼'}${Math.abs(pct)}%` : '·'}
      </Text>
    </View>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={font.h3}>{v}</Text>
      <Text style={font.tiny}>{k}</Text>
    </View>
  );
}

function MuscleVolume({ onInfo }: { onInfo: () => void }) {
  const thisWk = weekStart(Date.now());
  const cur = weeklyMuscleSets(thisWk);
  const prev = weeklyMuscleSets(weekStart(thisWk - WEEK + 86_400_000));
  const muscles = GROWTH_MUSCLES.slice();
  for (const m of Object.keys(cur)) if (!muscles.includes(m) && !['Cardio', 'Other', 'Full Body'].includes(m)) muscles.push(m);
  const scale = Math.max(24, ...muscles.map((m) => cur[m] || 0));
  const status = (m: string, n: number) => {
    const T = muscleTarget(m);
    return n < T.min ? 'low' : n > T.max ? 'high' : 'ok';
  };
  const C = { low: colors.faint, ok: colors.success, high: colors.warning };
  const inRange = muscles.filter((m) => status(m, cur[m] || 0) === 'ok').length;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={font.h3}>סטים לשריר · השבוע</Text>
        <Pressable onPress={onInfo} hitSlop={8}>
          <Ionicons name="information-circle-outline" size={20} color={colors.faint} />
        </Pressable>
      </Row>
      <Row style={{ gap: spacing.md, marginVertical: spacing.sm }}>
        <Legend c={C.low} t="מתחת למינימום" />
        <Legend c={C.ok} t="אזור צמיחה" />
        <Legend c={C.high} t="גבוה" />
        <Text style={[font.tiny, { marginStart: 'auto' }]}>
          {inRange}/{muscles.length} באזור
        </Text>
      </Row>
      {muscles.map((m) => {
        const n = cur[m] || 0;
        const st = status(m, n);
        const T = muscleTarget(m);
        return (
          <View key={m} style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C[st] }} />
                <Text style={font.body}>{muscleHe(m)}</Text>
              </Row>
              <Text style={font.tiny}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{fmtNum(n)}</Text> / {T.min}–{T.max} · שבוע שעבר {fmtNum(prev[m] || 0)}
              </Text>
            </Row>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.elev2, marginTop: 4, overflow: 'hidden', direction: 'ltr' }}>
              <View style={{ position: 'absolute', left: `${(T.min / scale) * 100}%`, width: `${((T.max - T.min) / scale) * 100}%`, top: 0, bottom: 0, backgroundColor: 'rgba(34,197,94,0.18)' }} />
              <View style={{ width: `${Math.min(100, (n / scale) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: C[st] }} />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <Row style={{ gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
      <Text style={font.tiny}>{t}</Text>
    </Row>
  );
}

function ExplainSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const items: Array<[string, string]> = [
    ['סטים קשים בשבוע מניעים צמיחה.', 'יותר סטים שבועיים לשריר = יותר צמיחה, עם תשואה פוחתת. בערך 4 סטים זה המינימום; רוב הצמיחה מגיעה עד כ-10–20 (Pelland 2024; Schoenfeld 2017).'],
    ['היעדים שונים לכל שריר.', 'לכל שריר אזור משלו (למשל גב 10–20, יד אחורית 6–12, ישבן 4–12), לפי ה-volume landmarks של Renaissance Periodization.'],
    ['שרירים משניים נספרים חצי.', 'סט לחיצת חזה נספר 1 לחזה ו-½ ליד אחורית; סקוואט נספר ½ לישבן. הספירה הזו ניבאה צמיחה הכי טוב במטא-אנליזה של 2024.'],
    ['מעל האזור זה לא רע.', 'הצמיחה ממשיכה אבל לאט יותר, וההתאוששות הופכת למגבלה. אם הביצועים יורדים — להוריד.'],
    ['חזרות: כל טווח מ-6 עד 30 עובד', 'אם הסט מסתיים קרוב לכשל. לעצור 1–3 חזרות לפני כשל — כמעט אותה צמיחה עם פחות עייפות (Refalo 2023).'],
    ['רק סטי חימום לא נספרים.', 'כל סט עבודה שהושלם נספר, אז כדאי שיהיו קשים.'],
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="איך היעדים עובדים">
      {items.map(([b, t], i) => (
        <Text key={i} style={[font.body, { marginBottom: spacing.md, lineHeight: 22 }]}>
          <Text style={{ fontWeight: '800' }}>{b} </Text>
          {t}
        </Text>
      ))}
      <Text style={font.tiny}>היעדים הם ממוצעים — אם שריר ממשיך לצמוח עם פחות, או מתאושש טוב עם יותר, תסמכו על התוצאות.</Text>
    </Sheet>
  );
}

function LogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [type, setType] = useState('waist');
  const [value, setValue] = useState('');
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="רישום מדידה"
      footer={
        <Button
          title="שמירה"
          onPress={() => {
            const v = parseNum(value);
            if (v == null || v <= 0) return toast('הזינו מספר');
            addMeasurement(type, v);
            setValue('');
            onClose();
            toast('נשמר');
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
        {TAPE.map((t) => (
          <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />
        ))}
      </View>
      <Field label="ערך" keyboardType="decimal-pad" value={value} onChangeText={setValue} suffix="ס״מ" autoFocus />
      <Text style={[font.tiny, { borderRadius: radius.sm }]}>המדידה נשמרת לתאריך של היום.</Text>
    </Sheet>
  );
}
