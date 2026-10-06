import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { BarChart } from '../components/charts';
import { MacroWeekGrid } from '../components/MacroWeekGrid';
import { RulerPicker } from '../components/RulerPicker';
import { Button, Card, CardHeader, Chip, Field, Row, Screen, Segmented, Stat, parseNum } from '../components/ui';
import { expenditureHistory } from '../db/profile';
import {
  applyTargets,
  checkinDaysRemaining,
  checkinDue,
  currentTrendWeight,
  targetInput,
  updateExpenditureIfNeeded,
} from '../lib/coach';
import { formatShortDate, today } from '../lib/dates';
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
} from '../lib/tdee';
import { displayToKg, fmtWeight, kgToDisplay, weightLabel } from '../lib/units';
import { useApp } from '../state/store';
import { chevronForward, colors, font, radius, spacing } from '../theme';

const SPEED_COLOR = {
  Slow: colors.success,
  Moderate: colors.info,
  Fast: colors.warning,
  Aggressive: colors.danger,
} as const;

export const SPEED_HE: Record<string, string> = { Slow: 'איטי', Moderate: 'מתון', Fast: 'מהיר', Aggressive: 'אגרסיבי' };

export function Strategy() {
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>

          <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Pressable
              onPress={() => due && router.push('/program-update')}
              disabled={!due}
              style={({ pressed }) => ({
                width: 200,
                height: 200,
                borderRadius: 100,
                borderWidth: 8,
                borderColor: due ? colors.primarySoft : 'transparent',
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
                  צ׳ק-אין
                </Text>
                <Text style={{ color: due ? '#fff' : colors.muted, fontSize: 14, marginTop: 4, opacity: 0.75 }}>
                  {due ? 'הגיע הזמן' : days === 1 ? 'בעוד יום' : `בעוד ${days} ימים`}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Text style={[font.h2, { marginBottom: spacing.md }]}>התוכנית הנוכחית</Text>
          <Card>
            <Text style={font.h3}>תוכנית מאומנת</Text>
            <Text style={[font.small, { marginBottom: spacing.md }]}>
              {profile.program_since ? `${formatShortDate(profile.program_since)} – היום` : 'התחילה היום'}
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
              <Text style={font.small}>הוצאה קלורית</Text>
              <Text style={[font.small, { color: colors.text, fontWeight: '700' }]}>{profile.tdee} קק״ל ליום</Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={font.small}>{goal === 'lose' ? 'גירעון' : goal === 'gain' ? 'עודף' : 'מאזן'} יומי</Text>
              <Text style={[font.small, { color: colors.text, fontWeight: '700' }]}>
                {profile.target_kcal - profile.tdee >= 0 ? '+' : ''}
                {profile.target_kcal - profile.tdee} קק״ל
              </Text>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={font.small}>צ׳ק-אינים שהושלמו</Text>
              <Text style={[font.small, { color: colors.text, fontWeight: '700' }]}>{profile.checkin_count}</Text>
            </Row>
          </Card>

          <Text style={[font.h2, { marginTop: spacing.lg, marginBottom: spacing.md }]}>מטרה</Text>
          <Card>
            <Segmented<GoalType>
              options={[
                { value: 'lose', label: 'ירידה בשומן' },
                { value: 'maintain', label: 'שמירה' },
                { value: 'gain', label: 'עלייה במסה' },
              ]}
              value={goal}
              onChange={changeGoal}
            />
            {goal !== 'maintain' ? (
              <>
                <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={font.label}>קצב {goal === 'lose' ? 'ירידה' : 'עלייה'}</Text>
                  {speed ? (
                    <View style={{ backgroundColor: SPEED_COLOR[speed], paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>{SPEED_HE[speed]}</Text>
                    </View>
                  ) : null}
                </Row>
                <RulerPicker
                  min={RATE_RANGE[goal].min}
                  max={RATE_RANGE[goal].max}
                  step={0.05}
                  decimals={2}
                  majorEvery={5}
                  unit="% לשבוע"
                  value={pct}
                  color={speed ? SPEED_COLOR[speed] : colors.info}
                  onChange={(v) => scheduleApply({ rate_pct_week: v })}
                />
                <Row style={{ gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                  {RATE_PRESETS[goal].map((p) => (
                    <Chip
                      key={p.label}
                      label={`${SPEED_HE[p.label] ?? p.label} · ${p.pct}%`}
                      active={Math.abs(p.pct - pct) < 0.001}
                      color={SPEED_COLOR[p.label as keyof typeof SPEED_COLOR]}
                      onPress={() => scheduleApply({ rate_pct_week: p.pct })}
                    />
                  ))}
                </Row>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />
                <Row style={{ gap: spacing.md }}>
                  <Stat label="לשבוע" value={`${weekly >= 0 ? '+' : '−'}${Math.abs(kgToDisplay(weekly, units)).toFixed(2)}`} sub={wl} />
                  <Stat label="לחודש" value={`${weekly >= 0 ? '+' : '−'}${Math.abs(kgToDisplay(weekly * 4.33, units)).toFixed(1)}`} sub={wl} />
                  <Stat label="קלוריות" value={`${preview.calories}`} sub="קק״ל ליום" />
                </Row>
                <Text style={[font.tiny, { marginTop: spacing.sm }]}>
                  {speed === 'Slow'
                    ? 'הכי קל להתמיד בו, והכי טוב לשמירה על שריר. ההתקדמות הדרגתית.'
                    : speed === 'Moderate'
                      ? 'נקודת האיזון לרוב האנשים: התקדמות יציבה בלי הרבה רעב.'
                      : speed === 'Fast'
                        ? 'קשה יותר באופן מורגש. צפו ליותר רעב ולירידה מסוימת בכוח.'
                        : 'תובעני מאוד. רק לתקופות קצרות, עם הרבה חלבון.'}
                </Text>
              </>
            ) : (
              <Text style={font.small}>הקלוריות יעקבו אחרי ההוצאה שלך כדי שהמשקל יישאר יציב.</Text>
            )}
          </Card>

          {goal !== 'maintain' ? (
            <Card>
              <CardHeader
                title="משקל יעד"
                subtitle={trendKg != null ? `מגמה עכשיו ${fmtWeight(trendKg, units)}` : undefined}
                color={colors.weight}
              />
              <Field
                keyboardType="decimal-pad"
                value={goalWeight}
                onChangeText={setGoalWeight}
                placeholder={`יעד ב${wl}`}
                suffix={wl}
                onBlur={saveMacros}
              />
              {profile.goal_weight_kg != null && weeks != null && weeks < 520 ? (
                <Text style={font.small}>
                  נשארו {Math.abs(kgToDisplay(profile.goal_weight_kg - weightKg, units)).toFixed(1)} {wl} · בערך{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{Math.ceil(weeks)} שבועות</Text>
                </Text>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="חלבון" subtitle={`${preview.protein} ג׳ ליום`} color={colors.protein} />
            <Segmented<ProteinMode>
              options={[
                { value: 'auto', label: 'מומלץ' },
                { value: 'custom', label: 'מותאם אישית' },
              ]}
              value={profile.protein_mode}
              onChange={(protein_mode) => scheduleApply({ protein_mode })}
            />
            {profile.protein_mode === 'auto' ? (
              <Text style={[font.small, { lineHeight: 19 }]}>
                {preview.proteinGPerKg} ג׳/ק״ג × {preview.referenceWeightKg.toFixed(1)} ק״ג = {preview.protein} ג׳.{' '}
                {goal === 'lose'
                  ? 'חלבון גבוה (הקצה העליון של טווח 1.6–2.2 ג׳/ק״ג) שומר על השריר בגירעון.'
                  : goal === 'gain'
                    ? 'כ-1.8 ג׳/ק״ג מספיק לבניית שריר; יותר מזה לא הראה תועלת נוספת במחקרים.'
                    : 'כ-1.6 ג׳/ק״ג שומר על השריר בקלוריות שמירה.'}
                {userBmi > 27
                  ? ' מעל BMI 27 רק רבע מהמשקל העודף נספר, כך שהחלבון מחושב לפי מסה רזה ולא לפי שומן.'
                  : ''}
              </Text>
            ) : (
              <>
                <Field label="חלבון" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} suffix="ג׳ לק״ג משקל גוף" />
                <Text style={font.tiny}>טווח מבוסס מחקר: 1.6–2.2 ג׳/ק״ג. ערכים מחוץ ל-1.2–3.0 מוגבלים.</Text>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="שומן" subtitle={`${preview.fat} ג׳ ליום · הפחמימות משלימות (${preview.carbs} ג׳)`} color={colors.fat} />
            <Field label="שומן" keyboardType="number-pad" value={fat} onChangeText={setFat} suffix="% מהקלוריות" />
            <Text style={[font.tiny, { marginBottom: spacing.md }]}>
              לפחות 0.6 ג׳ לק״ג משקל גוף לבריאות הורמונלית, ולכל היותר 40%.
            </Text>
            <Button title="שמירה וחישוב מחדש" onPress={saveMacros} loading={busy} variant="secondary" />
          </Card>

          <Card>
            <CardHeader
              title="היסטוריית הוצאה קלורית"
              subtitle="מחושבת מחדש כל יום ממגמת המשקל ומהאכילה הרשומה"
              color={colors.expenditure}
              right={
                <Pressable onPress={() => router.push('/expenditure')} hitSlop={8}>
                  <Ionicons name={chevronForward} size={20} color={colors.faint} />
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
              <Text style={font.small}>ההוצאה מחושבת מחדש בכל יום שבו פותחים את האפליקציה.</Text>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
