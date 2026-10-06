import { useRouter } from 'expo-router';
import { Text, View, useWindowDimensions } from 'react-native';
import type { DailyTotal } from '../db/log';
import { addDays, formatShortDate, today } from '../lib/dates';
import { weekDays } from '../lib/series';
import { completedSessions, plannedSessions, summarizePeriod } from '../planning/model';
import { usePlanning } from '../planning/store';
import { R } from '../run/store';
import { useApp } from '../state/store';
import { L } from '../strength/store';
import { colors, font, spacing } from '../theme';
import { BarChart, Ring } from './charts';
import { Button, Card, Row, SectionTitle } from './ui';

export const monthStart = () => addDays(weekDays(today())[0], -28);
export const monthEnd = () => addDays(weekDays(today())[0], -1);

export function WeeklyReview({ days, totals, loading, error }: { days: string[]; totals: Map<string, DailyTotal>; loading: boolean; error: boolean }) {
  const data = usePlanning(s => s.data);
  const { profile, setSelectedDate } = useApp();
  const router = useRouter();
  if (!profile) return null;
  const plans = plannedSessions(data, R.plans, days[0], days[6]);
  const summary = summarizePeriod(plans, completedSessions(L.workouts, R.activities), [...totals.values()], days[0], days[6], today(), { kcal: profile.target_kcal, protein: profile.target_protein });
  return <>
    <SectionTitle>סיכום שבועי משולב</SectionTitle>
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Button title="שבוע קודם" variant="ghost" size="sm" onPress={() => setSelectedDate(addDays(days[0], -7))} />
        <Button title="השבוע" variant="ghost" size="sm" onPress={() => setSelectedDate(today())} />
        <Button title="שבוע הבא" variant="ghost" size="sm" onPress={() => setSelectedDate(addDays(days[0], 7))} />
      </Row>
      <Text style={[font.small, { textAlign: 'center', marginBottom: 14 }]}>{formatShortDate(days[0])} – {formatShortDate(days[6])}</Text>
      <Row style={{ justifyContent: 'space-around', alignItems: 'center' }}>
        <Ring size={110} stroke={9} value={summary.matched} max={summary.planned} label={`${summary.matched}/${summary.planned}`} sub="בוצעו מהתכנון" color={colors.primary} />
        <View style={{ flexShrink: 1, gap: 8 }}>
          <Text style={font.body}>{summary.completed} אימונים בוצעו בסך הכול</Text>
          <Text style={font.small}>{summary.strength} כוח · {summary.runs} ריצות · {summary.km.toFixed(1)} ק״מ</Text>
          {summary.extra ? <Text style={font.tiny}>{summary.extra} אימונים מעבר לתכנון</Text> : null}
        </View>
      </Row>
      {!summary.planned ? <Text style={[font.tiny, { marginTop: 10 }]}>אין אימונים מתוכננים לשבוע הזה. אפשר להגדיר חלוקה ביומן.</Text> : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16, paddingTop: 14 }}>
        <Text style={[font.h3, { marginBottom: 8 }]}>תזונה</Text>
        {loading || error ? <Text style={font.small}>{error ? 'לא ניתן לטעון את נתוני התזונה. חזרו למסך כדי לנסות שוב.' : 'טוען נתוני תזונה…'}</Text> : <>
          <Text style={font.body}>{summary.calorieDays} ימים בטווח הקלוריות · {summary.proteinDays} ימים ביעד החלבון</Text>
          <Text style={[font.tiny, { marginTop: 6 }]}>נרשמו {summary.loggedDays} מתוך {summary.elapsedDays} ימים שעברו. טווח קלוריות: ±10% מהיעד.</Text>
        </>}
      </View>
      <Button title="פתיחת יומן האימונים" variant="ghost" size="sm" onPress={() => router.push({ pathname: '/train', params: { tab: 'journal', date: days[0] } })} />
    </Card>
  </>;
}

export function MonthlyTrends({ totals, loading, error }: { totals: DailyTotal[]; loading: boolean; error: boolean }) {
  const data = usePlanning(s => s.data);
  const profile = useApp(s => s.profile);
  const { width } = useWindowDimensions();
  if (!profile) return null;
  const actual = completedSessions(L.workouts, R.activities);
  const from = monthStart();
  const to = monthEnd();
  const plans = plannedSessions(data, R.plans, from, to);
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = addDays(from, i * 7);
    return { start, ...summarizePeriod(plans, actual, totals, start, addDays(start, 6), today(), { kcal: profile.target_kcal, protein: profile.target_protein }) };
  });
  const chartWidth = Math.max(200, width - spacing.lg * 2 - 32);
  const labels = weeks.map(w => formatShortDate(w.start));
  return <>
    <SectionTitle>מגמות · ארבעה שבועות מלאים</SectionTitle>
    <Text style={[font.tiny, { marginBottom: 12 }]}>{formatShortDate(from)} – {formatShortDate(to)} · ללא השבוע הנוכחי החלקי</Text>
    <TrendPanel title="כוח · אימונים לשבוע" values={weeks.map(w => w.strength)} labels={labels} width={chartWidth} color={colors.primary} unit="אימונים" />
    <TrendPanel title="ריצה · מרחק לשבוע" values={weeks.map(w => Number(w.km.toFixed(1)))} labels={labels} width={chartWidth} color={colors.run} unit="ק״מ" />
    <Card>
      <Text style={[font.h3, { marginBottom: 12 }]}>תזונה · ימים ביעד</Text>
      {loading || error ? <Text style={font.small}>{error ? 'נתוני התזונה לא נטענו.' : 'טוען מגמות תזונה…'}</Text> : <>
        <Text style={font.small}>קלוריות בטווח ±10%</Text>
        <BarChart width={chartWidth} height={100} color={colors.calories} values={weeks.map(w => w.loggedDays ? w.calorieDays : null)} labels={labels} />
        <Text style={[font.small, { marginTop: 12 }]}>חלבון ביעד או מעליו</Text>
        <BarChart width={chartWidth} height={100} color={colors.protein} values={weeks.map(w => w.loggedDays ? w.proteinDays : null)} labels={labels} />
        <Text style={[font.tiny, { marginTop: 12 }]}>ימים שתועדו בכל שבוע: {weeks.map(w => `${w.loggedDays}/7`).join(' · ')}. ללא רישומים אין מדד עמידה ביעד.</Text>
        <Text style={[font.tiny, { marginTop: 6 }]}>ההשוואה מחושבת לפי יעדי התזונה הנוכחיים.</Text>
      </>}
    </Card>
  </>;
}
function TrendPanel({ title, values, labels, width, color, unit }: { title: string; values: number[]; labels: string[]; width: number; color: string; unit: string }) {
  const last = values[3]; const delta = last - values[2];
  return <Card>
    <Text style={[font.h3, { marginBottom: 12 }]}>{title}</Text>
    <BarChart values={values} labels={labels} width={width} height={110} color={color} />
    <Text style={[font.small, { marginTop: 10 }]}>{last} {unit} בשבוע האחרון · {delta === 0 ? 'ללא שינוי מהשבוע הקודם' : `${delta > 0 ? '+' : ''}${Number(delta.toFixed(1))} לעומת השבוע הקודם`}</Text>
  </Card>;
}
