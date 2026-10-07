import { Ionicons } from '@expo/vector-icons';
import { GoalAchievement } from '../../src/components/GoalAchievement';
import { MonthlyTrends, WeeklyReview, monthStart, monthEnd } from '../../src/components/TrainingOverview';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, TrendChart } from '../../src/components/charts';
import { LinkRowSmall } from '../../src/components/run';
import { ModeToggle, WeeklyNutrition, type NutritionMode } from '../../src/components/WeeklyNutrition';
import { Card, Row, SectionTitle, Segmented, Title } from '../../src/components/ui';
import { dailyTotals, type DailyTotal } from '../../src/db/log';
import { expenditureSeries, weightSeries, type ExpenditureSeries, type WeightSeries } from '../../src/lib/analytics';
import { formatShortDate, type ISODate } from '../../src/lib/dates';
import { weekDays } from '../../src/lib/series';
import { kgToDisplay, weightLabel } from '../../src/lib/units';
import { formatPace } from '../../src/run/format';
import { R, latestAssessment, runWeekStreak, useRunVersion, weeklyKm } from '../../src/run/store';
import { useApp } from '../../src/state/store';
import { exerciseName, fmtW, recentPRs, unitLabel, useLiftVersion, weeklyVolume, workouts } from '../../src/strength/store';
import { fmtCompact, fmtDate } from '../../src/strength/utils';
import { chevronForward, colors, font, spacing } from '../../src/theme';

export default function Progress() {
  const { profile, selectedDate, setSelectedDate, version } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  useLiftVersion();
  useRunVersion();
  const [section, setSection] = useState<'summary' | 'nutrition' | 'training'>('summary');
  const [mode, setMode] = useState<NutritionMode>('remaining');
  const [totals, setTotals] = useState<Map<ISODate, DailyTotal>>(new Map());
  const [monthTotals, setMonthTotals] = useState<DailyTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [exp, setExp] = useState<ExpenditureSeries | null>(null);
  const [wt, setWt] = useState<WeightSeries | null>(null);
  const days = weekDays(selectedDate);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setLoadError(false);
      setTotals(new Map());
      (async () => {
        const [tots, monthly, e, w] = await Promise.all([dailyTotals(days[0], days[6]), dailyTotals(monthStart(), monthEnd()), expenditureSeries(30, profile?.tdee ?? 0), weightSeries(30)]);
        if (!alive) return;
        setTotals(new Map(tots.map((t) => [t.date, t])));
        setMonthTotals(monthly);
        setExp(e);
        setWt(w);
      })().catch(() => { if (alive) setLoadError(true); }).finally(() => { if (alive) setLoading(false); });
      return () => {
        alive = false;
      };
    }, [days[0], version, profile?.tdee]),
  );

  if (!profile) return null;
  const units = profile.units;
  const cardW = (width - spacing.lg * 2 - spacing.md) / 2;
  const chartW = width - spacing.lg * 2 - 34;
  const lastTrend = wt?.trend.filter((v) => v != null).slice(-1)[0] ?? null;
  const lastTdee = exp?.tdee.filter((v) => v != null).slice(-1)[0] ?? profile.tdee;
  const vol = weeklyVolume(12);
  const km = weeklyKm(12);
  const prs = recentPRs(4);
  const a = latestAssessment();
  const fastest = R.activities.filter((x) => x.distance_m >= 3000 && x.avg_pace_sec_per_km).sort((x, y) => x.avg_pace_sec_per_km! - y.avg_pace_sec_per_km!)[0];
  const longest = R.activities.slice().sort((x, y) => y.distance_m - x.distance_m)[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Title sub="עקביות לאורך זמן, מעבר למספר של היום">התקדמות</Title>
        <Segmented options={[{ value: 'summary', label: 'תמונה כללית' }, { value: 'nutrition', label: 'תזונה ומשקל' }, { value: 'training', label: 'ביצועים' }]} value={section} onChange={setSection} />
        {section === 'summary' ? <>
        <WeeklyReview days={days} totals={totals} loading={loading} error={loadError} />
        {!loading && !loadError ? <GoalAchievement days={days} totals={totals} selected={selectedDate} /> : null}

        </> : null}
        {section === 'nutrition' ? <>
        <SectionTitle>תזונה השבוע</SectionTitle>
        <Text style={[font.small, { marginBottom: 12 }]}>{formatShortDate(days[0])} – {formatShortDate(days[6])}</Text>
        <Card>
          <WeeklyNutrition
            days={days}
            totals={totals}
            selected={selectedDate}
            onSelect={setSelectedDate}
            targets={{ kcal: profile.target_kcal, protein: profile.target_protein, fat: profile.target_fat, carbs: profile.target_carbs }}
            mode={mode}
          />
          <View style={{ marginTop: spacing.lg }}>
            <ModeToggle value={mode} onChange={setMode} />
          </View>
        </Card>

        <Row style={{ gap: spacing.md }}>
          <InsightCard width={cardW} title="הוצאה קלורית" value={`${Math.round(lastTdee)}`} unit="קק״ל" onPress={() => router.push('/expenditure')}>
            {exp ? (
              <TrendChart
                compact
                holdingLast
                width={cardW - 34}
                height={60}
                color={colors.expenditure}
                bandColor={colors.expenditureSoft}
                points={exp.dates.map((_, i) => ({ trend: exp.tdee[i], lo: exp.lo[i], hi: exp.hi[i] }))}
              />
            ) : null}
          </InsightCard>
          <InsightCard
            width={cardW}
            title="מגמת משקל"
            value={lastTrend != null ? kgToDisplay(lastTrend, units).toFixed(1) : '—'}
            unit={weightLabel(units)}
            onPress={() => router.push('/weight')}
          >
            {wt && wt.dates.length ? (
              <TrendChart
                compact
                width={cardW - 34}
                height={60}
                color={colors.weight}
                points={wt.dates.map((_, i) => ({ trend: wt.trend[i] != null ? kgToDisplay(wt.trend[i]!, units) : null }))}
              />
            ) : (
              <View style={{ height: 60, justifyContent: 'center' }}>
                <Text style={font.tiny}>רשמו שקילה כדי להתחיל</Text>
              </View>
            )}
          </InsightCard>
        </Row>

        <Pressable onPress={() => router.push('/body')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ gap: spacing.md, flex: 1 }}>
                <Ionicons name="body-outline" size={22} color={colors.weight} />
                <View style={{ flex: 1 }}>
                  <Text style={font.h3}>הרכב גוף</Text>
                  <Text style={font.tiny}>אחוז שומן ומסת שריר מתמונה מקדימה ומהצד, והשוואה לאורך זמן</Text>
                </View>
              </Row>
              <Ionicons name={chevronForward} size={18} color={colors.faint} />
            </Row>
          </Card>
        </Pressable>

        </> : null}
        {section === 'training' ? <>
        <MonthlyTrends totals={monthTotals} loading={loading} error={loadError} />
        <SectionTitle right={<LinkRowSmall label="עוד" onPress={() => router.push('/strength/stats')} />}>כוח · נפח שבועי ({unitLabel()})</SectionTitle>
        <Card>
          <BarChart
            width={chartW}
            height={130}
            color={colors.primary}
            values={vol.map((w) => Math.round(fmtW(w.volume)))}
            labels={vol.map((w, i) => (i % 3 === 0 ? fmtDate(w.t, { day: 'numeric', month: 'short' }) : ''))}
          />
          <Row style={{ justifyContent: 'space-around', marginTop: spacing.sm }}>
            <Mini label="אימונים" value={String(workouts().length)} />
            <Mini label="השבוע" value={`${fmtCompact(fmtW(vol[vol.length - 1].volume))}`} />
            <Mini label="סטים השבוע" value={String(vol[vol.length - 1].sets)} />
          </Row>
          {prs.length ? (
            <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
              <Text style={[font.label, { marginBottom: 4 }]}>שיאים אחרונים</Text>
              {prs.map((p, i) => (
                <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Row style={{ gap: 6, flex: 1 }}>
                    <Ionicons name="trophy" size={13} color={colors.pr} />
                    <Text style={font.body} numberOfLines={1}>
                      {exerciseName(p.exerciseId)}
                    </Text>
                  </Row>
                  <Text style={font.tiny}>{p.hits.join(' · ')}</Text>
                </Row>
              ))}
            </View>
          ) : null}
        </Card>

        <SectionTitle right={<LinkRowSmall label="עוד" onPress={() => router.push('/run/goals')} />}>ריצה · ק״מ לשבוע</SectionTitle>
        <Card>
          <BarChart
            width={chartW}
            height={130}
            color={colors.run}
            values={km.map((w) => w.km)}
            labels={km.map((w, i) => (i % 3 === 0 ? new Date(w.start).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : ''))}
          />
          <Row style={{ justifyContent: 'space-around', marginTop: spacing.sm }}>
            <Mini label="VDOT" value={a?.vdot != null ? String(a.vdot) : '—'} />
            <Mini label="רצף שבועות" value={String(runWeekStreak())} />
            <Mini label="הארוכה" value={longest ? `${(longest.distance_m / 1000).toFixed(1)}` : '—'} />
            <Mini label="הקצב המהיר" value={fastest ? formatPace(fastest.avg_pace_sec_per_km) : '—'} />
          </Row>
        </Card>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[font.h3, { writingDirection: 'ltr' }]}>{value}</Text>
      <Text style={font.tiny}>{label}</Text>
    </View>
  );
}

function InsightCard({
  title,
  width,
  value,
  unit,
  onPress,
  children,
}: {
  title: string;
  width: number;
  value: string;
  unit: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ width }}>
        <Text style={font.h3}>{title}</Text>
        <Text style={[font.tiny, { marginBottom: spacing.sm }]}>30 ימים אחרונים</Text>
        {children}
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={[font.h2, { fontSize: 20 }]}>
            {value}
            <Text style={font.tiny}> {unit}</Text>
          </Text>
          <Ionicons name={chevronForward} size={18} color={colors.faint} />
        </Row>
      </Card>
    </Pressable>
  );
}
