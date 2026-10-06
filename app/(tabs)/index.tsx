import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MacroBar, TrendChart } from '../../src/components/charts';
import { LinkRowSmall, NoPlanCard, ReadinessCard, RunHero } from '../../src/components/run';
import { DeloadCard, StrengthHero } from '../../src/components/strengthCards';
import { Card, IconButton, Row, SectionTitle } from '../../src/components/ui';
import { totalsForDate } from '../../src/db/log';
import type { DayTotals } from '../../src/db/types';
import { weightForDate } from '../../src/db/weight';
import { weightSeries, type WeightSeries } from '../../src/lib/analytics';
import { checkinDue } from '../../src/lib/coach';
import { formatLongDate, today } from '../../src/lib/dates';
import { hasIntervals, latestAssessment, planFor, useRunVersion } from '../../src/run/store';
import { useApp } from '../../src/state/store';
import { useLiftVersion } from '../../src/strength/store';
import { kgToDisplay, weightLabel } from '../../src/lib/units';
import { chevronForward, colors, font, radius, spacing } from '../../src/theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

export default function Today() {
  const { profile, version, setSelectedDate } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  useLiftVersion();
  useRunVersion();
  const [totals, setTotals] = useState<DayTotals | null>(null);
  const [wt, setWt] = useState<WeightSeries | null>(null);
  const [weighed, setWeighed] = useState(false);
  const [icu, setIcu] = useState(true);
  const t = today();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setSelectedDate(t);
      (async () => {
        const [tot, w, todayW, connected] = await Promise.all([totalsForDate(t), weightSeries(14), weightForDate(t), hasIntervals()]);
        if (!alive) return;
        setTotals(tot);
        setWt(w);
        setWeighed(!!todayW);
        setIcu(connected);
      })();
      return () => {
        alive = false;
      };
    }, [t, version]),
  );

  if (!profile) return null;
  const run = planFor(t);
  const assessment = latestAssessment();
  const kcal = totals?.kcal ?? 0;
  const left = profile.target_kcal - kcal;
  const lastTrend = wt?.trend.filter((v) => v != null).slice(-1)[0] ?? null;
  const params = { date: t, meal: 'snack' };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Row style={{ marginBottom: spacing.lg, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={[font.label, { fontSize: 12.5 }]}>{formatLongDate(t)}</Text>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>{greeting()}</Text>
          </View>
          <IconButton name="settings-outline" onPress={() => router.push('/settings')} bg={colors.elev2} />
        </Row>

        {checkinDue(profile) ? (
          <Pressable onPress={() => router.push('/program-update')}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: colors.primary }}>
              <Ionicons name="checkmark-done-circle" size={28} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={font.h3}>צ׳ק-אין שבועי מוכן</Text>
                <Text style={font.small}>בדיקת השבוע ועדכון יעדי התזונה</Text>
              </View>
              <Ionicons name={chevronForward} size={18} color={colors.faint} />
            </Card>
          </Pressable>
        ) : null}

        {/* ---- nutrition ---- */}
        <SectionTitle right={<LinkRowSmall label="ליומן" onPress={() => router.push('/(tabs)/nutrition')} />}>תזונה</SectionTitle>
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md }}>
            <View>
              <Text style={font.label}>{left >= 0 ? 'נשארו היום' : 'מעל היעד'}</Text>
              <Text style={[font.display, { color: left >= 0 ? colors.text : colors.danger }]}>
                {Math.abs(Math.round(left))}
                <Text style={[font.small, { fontWeight: '600' }]}> קק״ל</Text>
              </Text>
            </View>
            <Text style={font.small}>
              {Math.round(kcal)} / {profile.target_kcal}
            </Text>
          </Row>
          <MacroBar label="חלבון" value={totals?.protein ?? 0} max={profile.target_protein} color={colors.protein} />
          <MacroBar label="פחמימות" value={totals?.carbs ?? 0} max={profile.target_carbs} color={colors.carbs} />
          <MacroBar label="שומן" value={totals?.fat ?? 0} max={profile.target_fat} color={colors.fat} />
          <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <QuickBtn icon="search" label="חיפוש" onPress={() => router.push({ pathname: '/food/search', params })} />
            <QuickBtn icon="barcode-outline" label="ברקוד" onPress={() => router.push({ pathname: '/food/scan', params })} />
            <QuickBtn icon="sparkles-outline" label="צילום AI" onPress={() => router.push({ pathname: '/food/photo', params })} />
          </Row>
        </Card>

        {/* ---- strength ---- */}
        <SectionTitle right={<LinkRowSmall label="לאימונים" onPress={() => router.push('/(tabs)/train')} />}>כוח</SectionTitle>
        <StrengthHero />
        <DeloadCard compact />

        {/* ---- running ---- */}
        <SectionTitle right={<LinkRowSmall label="לתוכנית" onPress={() => router.push({ pathname: '/(tabs)/train', params: { tab: 'run' } })} />}>ריצה</SectionTitle>
        {run ? <RunHero plan={run} compact /> : <NoPlanCard connected={icu} />}
        {assessment ? <ReadinessCard a={assessment} /> : null}

        {/* ---- body ---- */}
        <SectionTitle right={<LinkRowSmall label="למגמה" onPress={() => router.push('/weight')} />}>משקל</SectionTitle>
        <Pressable onPress={() => router.push('/weight')}>
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={font.label}>מגמה</Text>
                <Text style={font.h1}>
                  {lastTrend != null ? kgToDisplay(lastTrend, profile.units).toFixed(1) : '—'}
                  <Text style={font.small}> {weightLabel(profile.units)}</Text>
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  backgroundColor: weighed ? colors.successSoft : colors.primarySoft,
                }}
              >
                <Text style={{ color: weighed ? colors.success : colors.primary, fontWeight: '700', fontSize: 12 }}>
                  {weighed ? 'נשקלת היום ✓' : 'לרשום שקילה'}
                </Text>
              </View>
            </Row>
            {wt && wt.dates.length > 1 ? (
              <View style={{ marginTop: spacing.sm }}>
                <TrendChart
                  compact
                  width={width - spacing.lg * 2 - 30}
                  height={70}
                  color={colors.weight}
                  points={wt.dates.map((_, i) => ({ trend: wt.trend[i] != null ? kgToDisplay(wt.trend[i]!, profile.units) : null }))}
                />
              </View>
            ) : null}
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 42,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.border : colors.elev2,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <Ionicons name={icon} size={16} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
