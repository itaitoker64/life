import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendChart } from '../../src/components/charts';
import { Card } from '../../src/components/ui';
import { ModeToggle, WeeklyNutrition, type NutritionMode } from '../../src/components/WeeklyNutrition';
import { dailyTotals, type DailyTotal } from '../../src/db/log';
import { expenditureSeries, weightSeries, type ExpenditureSeries, type WeightSeries } from '../../src/lib/analytics';
import { today, type ISODate } from '../../src/lib/dates';
import { weekDays } from '../../src/lib/series';
import { kgToDisplay, weightLabel } from '../../src/lib/units';
import { useApp } from '../../src/state/store';
import { colors, font, radius, shadow, spacing } from '../../src/theme';

export default function Dashboard() {
  const { profile, selectedDate, setSelectedDate, version } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<NutritionMode>('remaining');
  const [totals, setTotals] = useState<Map<ISODate, DailyTotal>>(new Map());
  const [exp, setExp] = useState<ExpenditureSeries | null>(null);
  const [wt, setWt] = useState<WeightSeries | null>(null);
  const days = weekDays(selectedDate);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [tots, e, w] = await Promise.all([
          dailyTotals(days[0], days[6]),
          expenditureSeries(7, profile?.tdee ?? 0),
          weightSeries(7),
        ]);
        if (!alive) return;
        setTotals(new Map(tots.map((t) => [t.date, t])));
        setExp(e);
        setWt(w);
      })();
      return () => {
        alive = false;
      };
    }, [days[0], version, profile?.tdee]),
  );

  if (!profile) return null;
  const units = profile.units;
  const cardW = (width - spacing.lg * 2 - spacing.md) / 2;
  const lastTrend = wt?.trend.filter((v) => v != null).slice(-1)[0] ?? null;
  const lastTdee = exp?.tdee.filter((v) => v != null).slice(-1)[0] ?? profile.tdee;
  const params = { date: selectedDate, meal: 'snack' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md }}>
            <Text style={[font.screenTitle, { fontSize: 22 }]}>Dashboard</Text>
            <Pressable
              onPress={() => router.push('/(tabs)/more')}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="options-outline" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Pressable onPress={() => setSelectedDate(today())}>
            <Text style={[font.h2, { marginBottom: spacing.lg }]}>Weekly Nutrition</Text>
          </Pressable>
          <WeeklyNutrition
            days={days}
            totals={totals}
            selected={selectedDate}
            onSelect={setSelectedDate}
            targets={{ kcal: profile.target_kcal, protein: profile.target_protein, fat: profile.target_fat, carbs: profile.target_carbs }}
            mode={mode}
          />
          <View style={{ marginTop: spacing.xl }}>
            <ModeToggle value={mode} onChange={setMode} />
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={font.h2}>Insights & Analytics</Text>
            <Pressable onPress={() => router.push('/(tabs)/strategy')}>
              <Text style={[font.small, { color: colors.text, fontWeight: '600', textDecorationLine: 'underline' }]}>See All</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <InsightCard
              title="Expenditure"
              width={cardW}
              onPress={() => router.push('/expenditure')}
              value={`${Math.round(lastTdee)}`}
              unit="kcal"
            >
              {exp ? (
                <TrendChart
                  compact
                  holdingLast
                  width={cardW - spacing.lg * 2}
                  height={64}
                  color={colors.expenditure}
                  bandColor={colors.expenditureSoft}
                  points={exp.dates.map((_, i) => ({ trend: exp.tdee[i], lo: exp.lo[i], hi: exp.hi[i] }))}
                />
              ) : null}
            </InsightCard>
            <InsightCard
              title="Weight Trend"
              width={cardW}
              onPress={() => router.push('/weight')}
              value={lastTrend != null ? kgToDisplay(lastTrend, units).toFixed(1) : '—'}
              unit={weightLabel(units)}
            >
              {wt && wt.dates.length ? (
                <TrendChart
                  compact
                  width={cardW - spacing.lg * 2}
                  height={64}
                  color={colors.weight}
                  points={wt.dates.map((_, i) => ({ trend: wt.trend[i] != null ? kgToDisplay(wt.trend[i]!, units) : null }))}
                />
              ) : (
                <View style={{ height: 64, justifyContent: 'center' }}>
                  <Text style={font.tiny}>Log a weigh-in to start</Text>
                </View>
              )}
            </InsightCard>
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
        <Pressable
          onPress={() => router.push({ pathname: '/food/search', params })}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.track,
            borderRadius: radius.pill,
            paddingHorizontal: 18,
            height: 56,
            gap: 12,
            ...shadow,
          }}
        >
          <Ionicons name="search" size={20} color={colors.text} />
          <Text style={[font.body, { color: colors.muted, flex: 1, fontSize: 17 }]}>Search for a food</Text>
          <Pressable onPress={() => router.push({ pathname: '/food/scan', params })} hitSlop={10}>
            <Ionicons name="barcode-outline" size={24} color={colors.text} />
          </Pressable>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/food/photo', params })}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center', ...shadow }}
        >
          <Ionicons name="sparkles" size={22} color={colors.text} />
        </Pressable>
      </View>
    </SafeAreaView>
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
      <Card style={{ width, marginBottom: 0 }}>
        <Text style={font.h3}>{title}</Text>
        <Text style={[font.small, { marginBottom: spacing.sm }]}>Last 7 Days</Text>
        {children}
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[font.h2, { fontSize: 22 }]}>
            {value}
            <Text style={[font.small, { color: colors.muted }]}> {unit}</Text>
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.faint} />
        </View>
      </Card>
    </Pressable>
  );
}
