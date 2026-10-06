import { Text, View } from 'react-native';
import type { DailyTotal } from '../db/log';
import { formatShortDate, today, toISODate } from '../lib/dates';
import { R, latestAssessment } from '../run/store';
import { useApp } from '../state/store';
import { L } from '../strength/store';
import { weeklyGoal } from '../strength/workout';
import { colors, font } from '../theme';
import { Card, Row, SectionTitle } from './ui';

export function GoalAchievement({ days, totals, selected }: { days: string[]; totals: Map<string, DailyTotal>; selected: string }) {
  const profile = useApp(s => s.profile);
  if (!profile) return null;
  const inWeek = (date: string) => date >= days[0] && date <= days[6];
  const strength = L.workouts.filter(w => inWeek(toISODate(new Date(w.startedAt)))).length;
  const km = R.activities.filter(a => inWeek(toISODate(new Date(a.start_time)))).reduce((n, a) => n + a.distance_m / 1000, 0);
  const runTarget = R.profile.weekly_km_target ?? latestAssessment()?.weekly_km_target;
  const day = totals.get(selected);
  const elapsed = days.filter(d => d <= today());
  const logged = elapsed.filter(d => totals.has(d));
  const calorieDays = logged.filter(d => profile.target_kcal > 0 && Math.abs(totals.get(d)!.kcal - profile.target_kcal) <= profile.target_kcal * 0.1).length;
  const proteinDays = logged.filter(d => profile.target_protein > 0 && totals.get(d)!.protein >= profile.target_protein).length;
  return <>
    <SectionTitle>עמידה ביעדים · {formatShortDate(days[0])} – {formatShortDate(days[6])}</SectionTitle>
    <Card>
      <Text style={[font.h3, { marginBottom: 14 }]}>אימונים השבוע</Text>
      <GoalBar label="אימוני כוח" value={strength} target={weeklyGoal()} unit="אימונים" color={colors.primary} />
      <GoalBar label="מרחק ריצה" value={km} target={runTarget ?? 0} unit="ק״מ" color={colors.run} />
      {!runTarget ? <Text style={font.tiny}>יעד המרחק יוצג לאחר יצירת תוכנית ריצה.</Text> : null}
    </Card>
    <Card>
      <Text style={[font.h3, { marginBottom: 14 }]}>תזונה · {formatShortDate(selected)}</Text>
      {day ? <>
        <GoalBar label="קלוריות" value={day.kcal} target={profile.target_kcal} unit="קק״ל" color={colors.calories} range />
        <GoalBar label="חלבון" value={day.protein} target={profile.target_protein} unit="גרם" color={colors.protein} />
        <GoalBar label="פחמימות" value={day.carbs} target={profile.target_carbs} unit="גרם" color={colors.carbs} range />
        <GoalBar label="שומן" value={day.fat} target={profile.target_fat} unit="גרם" color={colors.fat} range />
      </> : <Text style={font.small}>אין רישום תזונה ליום שנבחר.</Text>}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8 }}>
        <Text style={font.small}>השבוע: {calorieDays} ימים בטווח הקלוריות · {proteinDays} ימים ביעד החלבון</Text>
        <Text style={[font.tiny, { marginTop: 6 }]}>נרשמו {logged.length} מתוך {elapsed.length} ימים שעברו. טווח קלוריות: עד 10% מהיעד. ימים ללא רישום אינם נספרים כעמידה ביעד.</Text>
      </View>
    </Card>
  </>;
}

function GoalBar({ label, value, target, unit, color, range = false }: { label: string; value: number; target: number; unit: string; color: string; range?: boolean }) {
  const ratio = target > 0 ? value / target : 0;
  const reached = target > 0 && (range ? ratio >= 0.9 && ratio <= 1.1 : ratio >= 1);
  const exceeded = range && ratio > 1.1;
  const tint = reached ? colors.success : exceeded ? colors.warning : color;
  return <View style={{ marginBottom: 14 }}>
    <Row style={{ justifyContent: 'space-between', gap: 8 }}><Text style={font.body}>{label}</Text><Text style={font.small}>{value.toLocaleString('he-IL', { maximumFractionDigits: 1 })} / {target > 0 ? target.toLocaleString('he-IL') : '—'} {unit}</Text></Row>
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={target > 0 ? { min: 0, max: target, now: Math.min(value, target), text: `${Math.round(ratio * 100)} אחוז מהיעד` } : { text: 'לא הוגדר יעד' }} style={{ height: 10, backgroundColor: colors.track, borderRadius: 5, overflow: 'hidden', marginTop: 7 }}>
      <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: tint, borderRadius: 5 }} />
    </View>
    <Text style={[font.tiny, { color: tint, marginTop: 4 }]}>{target <= 0 ? 'לא הוגדר יעד' : exceeded ? `מעל הטווח · ${Math.round(ratio * 100)}% מהיעד` : reached ? range ? 'בטווח היעד (±10%)' : 'היעד הושג' : `${Math.round(ratio * 100)}% מהיעד`}</Text>
  </View>;
}
