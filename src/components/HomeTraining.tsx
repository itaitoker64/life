import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { addDays, formatDateLabel, formatLongDate, weekdayNarrow } from '../lib/dates';
import { weekDays } from '../lib/series';
import { completedSessions, matchSessions, plannedSessions, type TrainingKind } from '../planning/model';
import { usePlanning } from '../planning/store';
import { R, useRunVersion } from '../run/store';
import { L, useLiftVersion } from '../strength/store';
import { startFromRoutine } from '../strength/workout';
import { colors, font, spacing } from '../theme';
import { useStartWorkout } from './strengthCards';
import { Button, Card, Row, SectionTitle } from './ui';

const kinds: Record<TrainingKind, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  strength: { label: 'כוח', icon: 'barbell-outline', color: colors.primary },
  run: { label: 'ריצה', icon: 'walk-outline', color: colors.run },
  crossfit: { label: 'קרוספיט', icon: 'flash-outline', color: colors.flame },
};
export function useHomeTraining(date: string) {
  useLiftVersion(); useRunVersion();
  const { data, ready } = usePlanning();
  const days = weekDays(date);
  const plans = plannedSessions(data, R.plans, days[0], addDays(date, 14));
  const actual = completedSessions(L.workouts, R.activities, data).filter(a => a.date <= date);
  const matches = matchSessions(plans.filter(p => p.date <= date), actual);
  const remaining = plans.filter(p => p.status !== 'skipped' && !matches.has(p.id));
  const hasProgram = !!data.combinedProgram?.enabled || data.rules.some(r => !r.endDate || r.endDate >= date);
  return { ready, days, plans, actual, matches, hasProgram, session: remaining.find(p => p.date === date), next: remaining.find(p => p.date > date) };
}
export function TodayWorkout({ date, training }: { date: string; training: ReturnType<typeof useHomeTraining> }) {
  const router = useRouter();
  const start = useStartWorkout();
  const { ready, session, next, actual, matches, plans, hasProgram } = training;
  const recentWork = actual.some(a => a.date >= addDays(date, -2));
  const completed = actual.some(a => a.date === date) || plans.some(p => p.date === date && matches.has(p.id));
  // What was actually done today, e.g. "עליון · כוח · 62 דק׳ + ריצה 5.2 ק״מ".
  const doneToday = actual.filter(a => a.date === date).map(a => a.kind === 'run' && a.km ? `⁨${a.title}⁩ ${a.km.toFixed(1)} ק״מ` : a.minutes ? `⁨${a.title}⁩ · ${Math.round(a.minutes)} דק׳` : a.title).join(' + ');
  const active = L.active;
  const meta = session ? kinds[session.kind] : null;
  const journal = () => router.push({ pathname: '/(tabs)/train', params: { tab: 'journal', date } });
  function open() {
    if (active) return router.push('/strength/workout');
    if (!session) return journal();
    if (session.kind === 'crossfit') return router.push({ pathname: '/training/crossfit', params: { date, sessionId: session.id } });
    if (session.kind === 'run' && !session.coachDate) return journal();
    if (session.kind === 'run') return router.push({ pathname: '/run/day/[date]', params: { date } });
    if (session.routineId && L.routines.some(r => r.id === session.routineId)) return start(() => startFromRoutine(session.routineId!));
    journal();
  }
  return <Card style={{ borderColor: active || session ? colors.primary : colors.border, padding: 20 }}>
    <Row style={{ gap: 10, marginBottom: 16 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={active ? 'play' : meta?.icon ?? 'leaf-outline'} color={meta?.color ?? colors.primary} size={24} />
      </View>
      <View style={{ flex: 1 }}><Text style={font.small}>{active ? 'האימון שלך בעיצומו' : 'האימון של היום'}</Text><Text style={[font.h3, { color: meta?.color ?? colors.primary }]}>{active ? 'ממשיכים מאיפה שעצרת' : meta?.label ?? (completed ? 'כל הכבוד על האימון' : !hasProgram ? 'עוד אין תוכנית' : recentWork ? 'זמן להתאושש' : 'יום מנוחה')}</Text></View>
    </Row>
    <Text style={[font.h1, { marginBottom: 8 }]}>{!ready ? 'טוענים את התוכנית…' : active?.name ?? session?.title ?? (completed ? doneToday || 'האימונים להיום הושלמו' : 'אין אימון מתוכנן להיום')}</Text>
    <Text style={[font.small, { lineHeight: 21, marginBottom: 18 }]}>{active ? 'הסטים וההתקדמות שלך נשמרו.' : session ? [session.minutes ? `${session.minutes} דקות` : null, session.plannedEffort ? `עצימות מתוכננת ${session.plannedEffort}/10` : null, session.adjustment?.mode === 'reduce' ? 'עומס מופחת' : null].filter(Boolean).join(' · ') || 'האימון שנקבע בתוכנית שלך' : next ? `בהמשך: ${formatDateLabel(next.date)} · ${next.title}` : 'אפשר לבנות שבוע שמשלב כוח, ריצה וקרוספיט.'}</Text>
    {session?.adjustment && !active ? <Text style={[font.small, { color: colors.warning, lineHeight: 21, marginBottom: 16 }]}>{session.adjustment.reason}</Text> : null}
    <Button disabled={!ready} title={active ? 'המשך אימון' : session ? session.kind === 'strength' && session.routineId ? 'התחלת האימון' : 'פתיחת האימון' : !hasProgram && !completed ? 'בניית התוכנית שלך' : next || completed ? 'לצפייה ביומן' : 'בניית התוכנית שלך'} onPress={!active && !session && (!hasProgram || !next) && !completed ? () => router.push('/training/plan') : open} />
    {!active && session && session.kind !== 'run' ? <Button style={{ marginTop: 8 }} variant="ghost" title="בחדר כושר אחר? צילום והתאמה" onPress={() => router.push({ pathname: '/training/spontaneous', params: { date, sessionId: session.id } })} /> : null}
    {plans.filter(p => p.date === date && p.status !== 'skipped' && !matches.has(p.id)).length > 1 ? <Button variant="ghost" title="כל האימונים להיום" onPress={journal} /> : null}
  </Card>;
}
export function HomeWeek({ date, training }: { date: string; training: ReturnType<typeof useHomeTraining> }) {
  const router = useRouter();
  const { days, plans, actual, matches } = training;
  const week = plans.filter(p => p.date <= days[6] && p.status !== 'skipped');
  const done = week.filter(p => matches.has(p.id)).length;
  return <><SectionTitle right={<Text style={font.small}>{done} מתוך {week.length} מתוכננים הושלמו</Text>}>השבוע שלך</SectionTitle><Card>
    <Row style={{ gap: 3, alignItems: 'stretch' }}>{days.map(day => {
      const scheduled = week.filter(p => p.date === day);
      const performed = actual.filter(a => a.date === day);
      const complete = day <= date && (scheduled.length > 0 ? scheduled.every(p => matches.has(p.id)) : performed.length > 0);
      const kind = scheduled[0]?.kind ?? performed[0]?.kind;
      return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${formatLongDate(day)}, ${scheduled.map(p => p.title).join(', ') || (performed.length ? 'אימון שבוצע' : 'ללא אימון מתוכנן')}${complete ? ', הושלם' : ''}`} accessibilityState={{ selected: day === date }} onPress={() => router.push({ pathname: '/(tabs)/train', params: { tab: 'journal', date: day } })} style={{ flex: 1, minHeight: 94, alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 12, backgroundColor: day === date ? colors.primarySoft : 'transparent', borderWidth: 1, borderColor: day === date ? colors.primary : 'transparent' }}>
        <Text style={font.small}>{weekdayNarrow(day)}</Text>
        <Ionicons name={complete ? 'checkmark-circle' : kind ? kinds[kind].icon : 'remove-outline'} color={complete ? colors.success : kind ? kinds[kind].color : colors.faint} size={21} />
        <Text style={{ color: colors.muted, fontSize: 10 }} numberOfLines={1}>{scheduled.length > 1 ? `${scheduled.length} אימונים` : kind ? kinds[kind].label : 'מנוחה'}</Text>
      </Pressable>;
    })}</Row>
    <Text style={[font.tiny, { marginTop: spacing.md }]}>הקשה על יום פותחת את התכנון והאימונים שבוצעו.</Text>
  </Card></>;
}
