import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { addDays, formatLongDate, parseISODate, today, weekdayNarrow } from '../lib/dates';
import { weekDays } from '../lib/series';
import { completedSessions, matchSessions, plannedSessions, validDate, type Session } from '../planning/model';
import { updatePlanning, usePlanning } from '../planning/store';
import { R, useRunVersion } from '../run/store';
import { L, useLiftVersion } from '../strength/store';
import { colors, font, spacing } from '../theme';
import { PlanningEditor, MoveSession } from './PlanningEditor';
import { Button, Card, Row, SectionTitle, Segmented, Title } from './ui';

type Entry = { id: string; date: string; title: string; kind: 'strength' | 'run'; status: string; done: boolean; plan?: Session; open: () => void };
export function TrainingJournal() {
  useLiftVersion(); useRunVersion();
  const { data, ready } = usePlanning();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const [selected, setSelected] = useState(today);
  useEffect(() => { if (params.date && validDate(params.date)) setSelected(params.date); }, [params.date]);
  const [kind, setKind] = useState<'all' | 'strength' | 'run'>('all');
  const [period, setPeriod] = useState<'day' | 'past' | 'next'>('day');
  const [scheduling, setScheduling] = useState(false);
  const [moving, setMoving] = useState<Session | null>(null);
  const days = weekDays(selected);
  const now = today();
  const from = period === 'past' ? addDays(now, -90) : period === 'next' ? now : days[0];
  const to = period === 'next' ? addDays(now, 27) : period === 'past' ? now : days[6];
  const actual = completedSessions(L.workouts, R.activities);
  const plans = plannedSessions(data, R.plans, from < days[0] ? from : days[0], to > days[6] ? to : days[6]);
  const matches = matchSessions(plans, actual);
  const entries: Entry[] = actual.map(a => ({ ...a, done: true, status: a.kind === 'run' ? `בוצע · ${a.km.toFixed(1)} ק״מ` : 'בוצע', open: () => a.workoutId ? router.push({ pathname: '/strength/history/[id]', params: { id: a.workoutId } }) : router.push('/run/history') }));
  for (const plan of plans) {
    const match = matches.get(plan.id);
    if (match && !match.startsWith('marked:')) continue;
    const done = !!match;
    entries.push({ ...plan, plan, done, status: done ? 'סומן כבוצע' : plan.status === 'skipped' ? 'דולג' : plan.date < now ? 'לא סומן כבוצע' : 'מתוכנן', open: () => {
      if (plan.coachDate) router.push({ pathname: '/run/day/[date]', params: { date: plan.coachDate } });
      else if (plan.routineId && L.routines.some(r => r.id === plan.routineId)) router.push({ pathname: '/strength/routine/[id]', params: { id: plan.routineId } });
      else router.push({ pathname: '/train', params: { tab: plan.kind === 'run' ? 'run' : 'strength' } });
    } });
  }
  const visible = entries.filter(e => (kind === 'all' || e.kind === kind) && (period === 'day' ? e.date === selected : period === 'past' ? e.date >= from && (e.date < now || e.done && e.date === now) : e.date >= now && e.date <= to && !e.done && e.status === 'מתוכנן')).sort((a, b) => period === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  async function cancel(plan: Session) {
    try {
      await updatePlanning(d => ({ ...d, overrides: [...d.overrides.filter(o => o.id !== plan.id), { id: plan.id, originalDate: d.overrides.find(o => o.id === plan.id)?.originalDate ?? plan.date, date: plan.date, cancelled: true }] }));
    } catch { Alert.alert('הביטול נכשל', 'נסו שוב.'); }
  }
  return <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
    <Title sub="כוח וריצה · אימונים שבוצעו ותוכנית להמשך">יומן אימונים</Title>
    <Row style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <Button title="תכנון שבועי / שיבוץ" size="sm" disabled={!ready} onPress={() => setScheduling(true)} />
      <Button title="תזכורות" size="sm" variant="secondary" onPress={() => router.push('/reminders')} />
    </Row>
    <Segmented options={[{ value: 'all', label: 'הכול' }, { value: 'strength', label: 'כוח' }, { value: 'run', label: 'ריצה' }]} value={kind} onChange={setKind} />
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Button title="שבוע קודם" size="sm" variant="ghost" onPress={() => { setSelected(addDays(selected, -7)); setPeriod('day'); }} />
        <Button title="היום" size="sm" variant="ghost" onPress={() => { setSelected(now); setPeriod('day'); }} />
        <Button title="שבוע הבא" size="sm" variant="ghost" onPress={() => { setSelected(addDays(selected, 7)); setPeriod('day'); }} />
      </Row>
      <Text style={[font.small, { textAlign: 'center', marginBottom: 12 }]}>{parseISODate(days[0]).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</Text>
      <Row>{days.map(date => <Pressable key={date} accessibilityRole="button" accessibilityLabel={formatLongDate(date)} accessibilityState={{ selected: date === selected }} onPress={() => { setSelected(date); setPeriod('day'); }} style={{ flex: 1, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: selected === date ? colors.primarySoft : 'transparent', borderWidth: 1, borderColor: date === now ? colors.primary : 'transparent' }}>
        <Text style={font.tiny}>{weekdayNarrow(date)}</Text><Text style={font.h3}>{parseISODate(date).getDate()}</Text>
        <Row style={{ gap: 3 }}>{(['strength', 'run'] as const).map(k => entries.some(e => e.date === date && e.kind === k && (kind === 'all' || kind === k)) ? <View key={k} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: k === 'run' ? colors.run : colors.primary }} /> : null)}</Row>
      </Pressable>)}</Row>
      <Text style={[font.tiny, { marginTop: 12 }]}>כחול · כוח    טורקיז · ריצה</Text>
    </Card>
    <Segmented options={[{ value: 'day', label: 'היום שנבחר' }, { value: 'past', label: 'אימונים שהיו' }, { value: 'next', label: 'האימונים הבאים' }]} value={period} onChange={setPeriod} />
    <SectionTitle>{period === 'day' ? formatLongDate(selected) : period === 'past' ? '90 הימים האחרונים' : 'ארבעת השבועות הבאים'}</SectionTitle>
    {!visible.length ? <Card><Text style={font.small}>אין אימונים להצגה בטווח ובסוג שנבחרו.</Text></Card> : visible.map(e => <Card key={e.id}>
      <Pressable accessibilityRole="button" onPress={e.open}>
        <Row style={{ gap: 10 }}><Ionicons name={e.kind === 'run' ? 'walk-outline' : 'barbell-outline'} size={22} color={e.kind === 'run' ? colors.run : colors.primary} /><View style={{ flex: 1 }}><Text style={font.h3}>{e.title}</Text><Text style={font.small}>{formatLongDate(e.date)}</Text></View></Row>
        <Text style={[font.small, { color: e.done ? colors.success : colors.muted, marginTop: 8 }]}>{e.status}</Text>
        {e.plan?.coachDate && e.plan.coachDate !== e.date ? <Text style={font.tiny}>הועבר מ־{formatLongDate(e.plan.coachDate)} · הפרטים נפתחים מתוכנית המקור</Text> : null}
      </Pressable>
      {e.plan && !e.done && e.plan.status !== 'skipped' ? <Row style={{ gap: 12 }}><Button title="הזזת אימון" variant="ghost" size="sm" onPress={() => setMoving(e.plan!)} /><Button title="ביטול שיבוץ" variant="ghost" size="sm" onPress={() => cancel(e.plan!)} /></Row> : null}
    </Card>)}
    {scheduling ? <PlanningEditor date={selected < now ? now : selected} onClose={() => setScheduling(false)} /> : null}
    {moving ? <MoveSession session={moving} onClose={() => setMoving(null)} /> : null}
  </ScrollView>;
}
