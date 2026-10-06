import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MacroBar, TrendChart } from '../../src/components/charts';
import { LinkRowSmall } from '../../src/components/run';
import { HomeWeek, TodayWorkout, useHomeTraining } from '../../src/components/HomeTraining';
import { AlternateWorkout } from '../../src/components/AlternateWorkout';
import { Card, IconButton, Row, SectionTitle } from '../../src/components/ui';
import { totalsForDate } from '../../src/db/log';
import type { DayTotals } from '../../src/db/types';
import { weightForDate } from '../../src/db/weight';
import { weightInsights, weightSeries, type WeightSeries } from '../../src/lib/analytics';
import { checkinDue } from '../../src/lib/coach';
import { formatLongDate, today } from '../../src/lib/dates';
import { planFor } from '../../src/run/store';
import { useApp } from '../../src/state/store';
import { kgToDisplay, weightLabel } from '../../src/lib/units';
import { carbTip } from '../../src/lib/fueling';
import { stepsToday } from '../../src/lib/health';
import { chevronForward, colors, font, radius, spacing } from '../../src/theme';

export default function Today() {
  const { profile, version, setSelectedDate } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [totals, setTotals] = useState<DayTotals | null>(null);
  const [wt, setWt] = useState<WeightSeries | null>(null);
  const [weighed, setWeighed] = useState(false);
  const [logging, setLogging] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [steps, setSteps] = useState<number | null>(null);
  const t = today();
  const training = useHomeTraining(t);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setSelectedDate(t);
      setLoadError(false);
      (async () => {
        const [tot, w, todayW] = await Promise.all([totalsForDate(t), weightSeries(14), weightForDate(t)]);
        if (!alive) return;
        setTotals(tot);
        setWt(w);
        setWeighed(!!todayW);
        stepsToday().then((s) => alive && setSteps(s)).catch(() => {});
      })().catch(() => { if (alive) setLoadError(true); });
      return () => {
        alive = false;
      };
    }, [t, version]),
  );

  if (!profile) return null;
  const run = planFor(t);
  const kcal = totals?.kcal ?? 0;
  const left = profile.target_kcal - kcal;
  const lastTrend = wt?.trend.filter((v) => v != null).slice(-1)[0] ?? null;
  const params = { date: t, meal: 'snack' };
  const weeklyChange = wt ? weightInsights(wt.all).weeklyChangeKg : null;
  const fuel = carbTip(run, lastTrend);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Row style={{ marginBottom: spacing.lg, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={[font.label, { fontSize: 12.5 }]}>{formatLongDate(t)}</Text>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>היום שלך</Text>
            <Text style={[font.small, { marginTop: 6 }]}>{profile.goal === 'lose' ? 'ירידה במשקל · שמירה על כוח' : profile.goal === 'gain' ? 'עלייה במשקל · בניית כוח' : 'שמירה על משקל · כושר מאוזן'}</Text>
          </View>
          <IconButton name="settings-outline" onPress={() => router.push('/settings')} bg={colors.elev2} />
        </Row>

        <TodayWorkout date={t} training={training} />

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
        <SectionTitle right={<LinkRowSmall label="ליומן" onPress={() => router.push('/(tabs)/nutrition')} />}>תזונה היום</SectionTitle>
        <Card>
          {loadError ? <Text style={font.small}>לא הצלחנו לטעון את הנתונים. פתחו שוב את המסך לניסיון נוסף.</Text> : !totals ? <Text style={font.small}>טוענים את התזונה…</Text> : <>
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
          <MacroBar label="קלוריות" value={kcal} max={profile.target_kcal} color={colors.calories} unit="קק״ל" />
          <MacroBar label="חלבון" value={totals?.protein ?? 0} max={profile.target_protein} color={colors.protein} />
          <Text style={[font.small, { marginTop: 4 }]}>{totals.protein >= profile.target_protein ? 'יעד החלבון הושג' : `עוד ${Math.ceil(profile.target_protein - totals.protein)} גרם חלבון ליעד`}</Text>
          </>}
          <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <QuickBtn icon="add" label="הוספת אוכל" onPress={() => router.push({ pathname: '/food/search', params })} />
            <QuickBtn icon="barcode-outline" label="סריקת ברקוד" onPress={() => router.push({ pathname: '/food/scan', params })} />
          </Row>
          {fuel ? (
            <Row style={{ gap: 8, marginTop: spacing.md, padding: 10, borderRadius: radius.md, backgroundColor: colors.successSoft, alignItems: 'flex-start' }}>
              <Ionicons name="flash-outline" size={16} color={colors.carbs} />
              <Text style={[font.small, { flex: 1, color: colors.text }]}>{fuel.text}</Text>
            </Row>
          ) : null}
        </Card>

        <Row style={{ gap: 8, marginVertical: 8 }}>
          <QuickBtn icon="camera-outline" label="צילום ארוחה" onPress={() => router.push({ pathname: '/food/photo', params })} />
          <QuickBtn icon="scale-outline" label="שקילה" onPress={() => router.push('/weight')} />
          <QuickBtn icon="flash-outline" label="אימון אחר" onPress={() => setLogging(true)} />
        </Row>
        <HomeWeek date={t} training={training} />

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
            <Text style={[font.small, { marginTop: 8 }]}>{weeklyChange != null ? `${weeklyChange > 0 ? '+' : ''}${kgToDisplay(weeklyChange, profile.units).toFixed(2)} ${weightLabel(profile.units)} לשבוע בממוצע` : 'עוד כמה שקילות יעזרו לראות את הכיוון לאורך זמן.'}</Text>
            {steps != null ? <Text style={[font.small, { marginTop: 4 }]}>{steps.toLocaleString('he-IL')} צעדים היום</Text> : null}
            {wt && wt.dates.length > 1 ? (
              <View style={{ marginTop: spacing.sm }}>
                <TrendChart
                  compact
                  width={width - spacing.lg * 2 - 34}
                  height={70}
                  color={colors.weight}
                  points={wt.dates.map((_, i) => ({ trend: wt.trend[i] != null ? kgToDisplay(wt.trend[i]!, profile.units) : null }))}
                />
              </View>
            ) : null}
          </Card>
        </Pressable>
      </ScrollView>
      {logging ? <AlternateWorkout date={t} replacementId={training.session?.id} onClose={() => setLogging(false)} /> : null}
    </SafeAreaView>
  );
}

function QuickBtn({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'column',
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        minHeight: 60,
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
