import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from '../../src/components/charts';
import { MacroWeekGrid } from '../../src/components/MacroWeekGrid';
import { RulerPicker } from '../../src/components/RulerPicker';
import { Button, Card, CardHeader, Chip, Field, Row, Screen, Segmented, Stat, parseNum } from '../../src/components/ui';
import { expenditureHistory } from '../../src/db/profile';
import {
  applyTargets,
  checkinDaysRemaining,
  checkinDue,
  currentTrendWeight,
  targetInput,
  updateExpenditureIfNeeded,
} from '../../src/lib/coach';
import { formatShortDate, today } from '../../src/lib/dates';
import {
  RATE_PRESETS,
  RATE_RANGE,
  bmi,
  computeTargets,
  rateSpeed,
  weeklyChangeKg,
  weeksToGoal,
  type GoalType,
  type ProteinMode,
} from '../../src/lib/tdee';
import { displayToKg, fmtWeight, kgToDisplay, weightLabel } from '../../src/lib/units';
import { useApp } from '../../src/state/store';
import { colors, font, radius, spacing } from '../../src/theme';

const SPEED_COLOR = {
  Slow: colors.success,
  Moderate: colors.info,
  Fast: colors.warning,
  Aggressive: colors.danger,
} as const;

export default function Strategy() {
  const { profile, patchProfile, refreshProfile, version } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [trendKg, setTrendKg] = useState<number | null>(null);
  const [history, setHistory] = useState<Array<{ date: string; tdee: number; logged_days: number }>>([]);
  const [goalWeight, setGoalWeight] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      expenditureHistory(28).then((h) => setHistory(h.reverse()));
      currentTrendWeight().then(setTrendKg);
    }, [version]),
  );

  useEffect(() => {
    if (!profile) return;
    setProtein(String(profile.protein_g_kg));
    setFat(String(Math.round(profile.fat_pct * 100)));
    setGoalWeight(profile.goal_weight_kg != null ? kgToDisplay(profile.goal_weight_kg, profile.units).toFixed(1) : '');
  }, [profile?.protein_g_kg, profile?.fat_pct, profile?.goal_weight_kg, profile?.units]);

  if (!profile) return null;
  const units = profile.units;
  const goal = profile.goal;
  const weightKg = trendKg ?? 75;
  const pct = profile.rate_pct_week;
  const speed = goal === 'maintain' ? null : rateSpeed(goal, pct);
  const weekly = weeklyChangeKg(goal, pct, weightKg);
  const preview = computeTargets(targetInput(profile, weightKg));
  const userBmi = bmi(weightKg, profile.height_cm);
  const weeks = profile.goal_weight_kg != null ? weeksToGoal(weightKg, profile.goal_weight_kg, weekly) : null;
  const days = checkinDaysRemaining(profile);
  const due = checkinDue(profile);
  const chartW = width - spacing.lg * 4;
  const wl = weightLabel(units);

  function scheduleApply(patch: Parameters<typeof patchProfile>[0]) {
    patchProfile(patch);
    if (applyTimer.current) clearTimeout(applyTimer.current);
    applyTimer.current = setTimeout(async () => {
      await applyTargets();
      await refreshProfile();
    }, 600);
  }

  function changeGoal(g: GoalType) {
    const patch: Parameters<typeof patchProfile>[0] = { goal: g };
    if (g !== 'maintain') {
      const r = RATE_RANGE[g];
      if (pct < r.min || pct > r.max) patch.rate_pct_week = RATE_PRESETS[g][1].pct;
    }
    scheduleApply(patch);
  }

  async function saveMacros() {
    setBusy(true);
    const p = parseNum(protein);
    const f = parseNum(fat);
    const gw = parseNum(goalWeight);
    await patchProfile({
      protein_g_kg: p != null ? Math.min(3, Math.max(1.2, p)) : profile!.protein_g_kg,
      fat_pct: f != null ? Math.min(0.5, Math.max(0.15, f / 100)) : profile!.fat_pct,
      goal_weight_kg: gw != null && gw > 0 ? displayToKg(gw, units) : null,
    });
    await updateExpenditureIfNeeded(true);
    await applyTargets();
    await refreshProfile();
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md }}>
            <Text style={[font.screenTitle, { fontSize: 22, color: colors.text }]}>Strategy</Text>
          </View>

          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Pressable
              onPress={() => due && router.push('/program-update')}
              disabled={!due}
              style={({ pressed }) => ({
                width: 200,
                height: 200,
                borderRadius: 100,
                borderWidth: 8,
                borderColor: due ? colors.track : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 178,
                  height: 178,
                  borderRadius: 89,
                  backgroundColor: due ? colors.black : colors.track,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: due ? '#fff' : colors.muted, fontSize: 22, fontWeight: '800', letterSpacing: 1 }}>
                  CHECK IN
                </Text>
                <Text style={{ color: due ? '#fff' : colors.muted, fontSize: 14, marginTop: 4, opacity: 0.75 }}>
                  {due ? "it's time" : `in ${days} day${days === 1 ? '' : 's'}`}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Text style={[font.h2, { marginBottom: spacing.md }]}>In Progress</Text>
          <Card>
            <Text style={font.h3}>Coached Program</Text>
            <Text style={[font.small, { marginBottom: spacing.md }]}>
              {profile.program_since ? `${formatShortDate(profile.program_since)} – Now` : 'Started today'}
            </Text>
            <MacroWeekGrid
              calories={profile.target_kcal}
              protein={profile.target_protein}
              fat={profile.target_fat}
              carbs={profile.target_carbs}
              height={230}
            />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={font.small}>Expenditure</Text>
              <Text style={[font.small, { color: colors.text, fontWeight: '700' }]}>{profile.tdee} kcal / day</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={font.small}>Daily {goal === 'lose' ? 'deficit' : goal === 'gain' ? 'surplus' : 'balance'}</Text>
              <Text style={[font.small, { color: colors.text, fontWeight: '700' }]}>
                {profile.target_kcal - profile.tdee >= 0 ? '+' : ''}
                {profile.target_kcal - profile.tdee} kcal
              </Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={font.small}>Check-ins completed</Text>
              <Text style={[font.small, { color: colors.text, fontWeight: '700' }]}>{profile.checkin_count}</Text>
            </Row>
          </Card>

          <Text style={[font.h2, { marginTop: spacing.lg, marginBottom: spacing.md }]}>Goal</Text>
          <Card>
            <Segmented<GoalType>
              options={[
                { value: 'lose', label: 'Lose fat' },
                { value: 'maintain', label: 'Maintain' },
                { value: 'gain', label: 'Gain muscle' },
              ]}
              value={goal}
              onChange={changeGoal}
            />
            {goal !== 'maintain' ? (
              <>
                <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={font.label}>Rate of {goal === 'lose' ? 'loss' : 'gain'}</Text>
                  {speed ? (
                    <View style={{ backgroundColor: SPEED_COLOR[speed], paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{speed}</Text>
                    </View>
                  ) : null}
                </Row>
                <RulerPicker
                  min={RATE_RANGE[goal].min}
                  max={RATE_RANGE[goal].max}
                  step={0.05}
                  decimals={2}
                  majorEvery={5}
                  unit="% / week"
                  value={pct}
                  color={speed ? SPEED_COLOR[speed] : colors.info}
                  onChange={(v) => scheduleApply({ rate_pct_week: v })}
                />
                <Row style={{ gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                  {RATE_PRESETS[goal].map((p) => (
                    <Chip
                      key={p.label}
                      label={`${p.label} · ${p.pct}%`}
                      active={Math.abs(p.pct - pct) < 0.001}
                      color={SPEED_COLOR[p.label as keyof typeof SPEED_COLOR]}
                      onPress={() => scheduleApply({ rate_pct_week: p.pct })}
                    />
                  ))}
                </Row>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
                <Row style={{ gap: spacing.md }}>
                  <Stat label="Per week" value={`${weekly >= 0 ? '+' : '−'}${Math.abs(kgToDisplay(weekly, units)).toFixed(2)}`} sub={wl} />
                  <Stat label="Per month" value={`${weekly >= 0 ? '+' : '−'}${Math.abs(kgToDisplay(weekly * 4.33, units)).toFixed(1)}`} sub={wl} />
                  <Stat label="Calories" value={`${preview.calories}`} sub="kcal / day" />
                </Row>
                <Text style={[font.tiny, { marginTop: spacing.sm }]}>
                  {speed === 'Slow'
                    ? 'Easiest to sustain, best for keeping muscle. Progress is gradual.'
                    : speed === 'Moderate'
                      ? 'The sweet spot for most people: steady progress without much hunger.'
                      : speed === 'Fast'
                        ? 'Noticeably harder. Expect more hunger and some strength loss.'
                        : 'Very demanding. Only for short pushes; keep protein high.'}
                </Text>
              </>
            ) : (
              <Text style={font.small}>Your calories will track your expenditure so your weight stays stable.</Text>
            )}
          </Card>

          {goal !== 'maintain' ? (
            <Card>
              <CardHeader
                title="Goal weight"
                subtitle={trendKg != null ? `Trend now ${fmtWeight(trendKg, units)}` : undefined}
                color={colors.weight}
              />
              <Field
                keyboardType="decimal-pad"
                value={goalWeight}
                onChangeText={setGoalWeight}
                placeholder={`Target ${wl}`}
                suffix={wl}
                onBlur={saveMacros}
              />
              {profile.goal_weight_kg != null && weeks != null && weeks < 520 ? (
                <Text style={font.small}>
                  {Math.abs(kgToDisplay(profile.goal_weight_kg - weightKg, units)).toFixed(1)} {wl} to go · about{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{Math.ceil(weeks)} weeks</Text>
                </Text>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Protein" subtitle={`${preview.protein} g / day`} color={colors.protein} />
            <Segmented<ProteinMode>
              options={[
                { value: 'auto', label: 'Recommended' },
                { value: 'custom', label: 'Custom' },
              ]}
              value={profile.protein_mode}
              onChange={(protein_mode) => scheduleApply({ protein_mode })}
            />
            {profile.protein_mode === 'auto' ? (
              <Text style={[font.small, { lineHeight: 19 }]}>
                {preview.proteinGPerKg} g/kg × {preview.referenceWeightKg.toFixed(1)} kg = {preview.protein} g.{' '}
                {goal === 'lose'
                  ? 'Higher protein (top of the 1.6–2.2 g/kg evidence range) protects muscle in a deficit.'
                  : goal === 'gain'
                    ? 'Around 1.8 g/kg covers muscle growth; more has no added benefit in the research.'
                    : 'About 1.6 g/kg maintains muscle at maintenance calories.'}
                {userBmi > 27
                  ? ` Above a BMI of 27 only a quarter of the extra weight counts, so protein tracks lean mass, not body fat.`
                  : ''}
              </Text>
            ) : (
              <>
                <Field label="Protein" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} suffix="g / kg bodyweight" />
                <Text style={font.tiny}>Evidence range: 1.6–2.2 g/kg. Values outside 1.2–3.0 are clamped.</Text>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Fat" subtitle={`${preview.fat} g / day · carbs fill the rest (${preview.carbs} g)`} color={colors.fat} />
            <Field label="Fat" keyboardType="number-pad" value={fat} onChangeText={setFat} suffix="% of calories" />
            <Text style={[font.tiny, { marginBottom: spacing.md }]}>
              Kept at or above 0.6 g/kg bodyweight for hormonal health, and at most 40 %.
            </Text>
            <Button title="Save & recalculate" onPress={saveMacros} loading={busy} variant="secondary" />
          </Card>

          <Card>
            <CardHeader
              title="Expenditure history"
              subtitle="Recalculated daily from weight trend and logged intake"
              color={colors.expenditure}
              right={
                <Pressable onPress={() => router.push('/expenditure')} hitSlop={8}>
                  <Ionicons name="chevron-forward" size={20} color={colors.faint} />
                </Pressable>
              }
            />
            {history.length ? (
              <BarChart
                width={chartW}
                color={colors.expenditure}
                values={history.map((h) => h.tdee)}
                labels={history.map((h, i) => (i % Math.max(1, Math.ceil(history.length / 4)) === 0 ? formatShortDate(h.date) : ''))}
              />
            ) : (
              <Text style={font.small}>Expenditure is recalculated every day you open the app.</Text>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
