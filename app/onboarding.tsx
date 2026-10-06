import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, CardHeader, Chip, Field, Row, Screen, Segmented, Title, parseNum } from '../src/components/ui';
import { upsertWeight } from '../src/db/weight';
import { applyTargets } from '../src/lib/coach';
import { today } from '../src/lib/dates';
import {
  RATE_PRESETS,
  initialExpenditure,
  weeklyChangeKg,
  type ActivityLevel,
  type GoalType,
  type Sex,
} from '../src/lib/tdee';
import { displayToKg, kgToDisplay, weightLabel, type Units } from '../src/lib/units';
import { colors, font, spacing } from '../src/theme';
import { useApp } from '../src/state/store';
import { SPEED_HE } from '../src/screens/Strategy';

export default function Onboarding() {
  const { patchProfile, init } = useApp();
  const [units, setUnits] = useState<Units>('metric');
  const [sex, setSex] = useState<Sex>('male');
  const [birthYear, setBirthYear] = useState('1995');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<GoalType>('lose');
  const [pct, setPct] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const w = parseNum(weight);
  const weightKgPreview = w ? displayToKg(w, units) : null;
  const weekly = weightKgPreview ? weeklyChangeKg(goal, pct, weightKgPreview) : null;

  function changeGoal(g: GoalType) {
    setGoal(g);
    if (g !== 'maintain') setPct(RATE_PRESETS[g][1].pct);
  }

  async function finish() {
    const h = parseNum(height);
    const y = parseNum(birthYear);
    const gw = parseNum(goalWeight);
    if (!w || !h || !y) {
      setError('נא למלא משקל, גובה ושנת לידה.');
      return;
    }
    setBusy(true);
    const weightKg = displayToKg(w, units);
    const heightCm = units === 'metric' ? h : h * 2.54;
    const age = new Date().getFullYear() - y;
    const tdee = initialExpenditure(sex, weightKg, heightCm, age, activity);
    const t = today();
    await upsertWeight(t, weightKg);
    await patchProfile({
      onboarded: 1,
      units,
      sex,
      birth_year: y,
      height_cm: heightCm,
      activity,
      goal,
      rate_pct_week: pct,
      goal_weight_kg: gw && gw > 0 ? displayToKg(gw, units) : null,
      tdee,
      program_start: t,
      last_expenditure_update: t,
    });
    await applyTargets();
    await init();
    setBusy(false);
  }

  const wl = weightLabel(units);

  return (
    <Screen>
      <Title sub="כמה פרטים כדי להעריך את ההוצאה הקלורית ההתחלתית. היא מתעדכנת אוטומטית כשרושמים אוכל ומשקל.">
        ברוכים הבאים ל-Life
      </Title>

      <Card>
        <CardHeader title="עליך" />
        <Segmented<Units>
          options={[
            { value: 'metric', label: 'ק״ג / ס״מ' },
            { value: 'imperial', label: 'lb / אינץ׳' },
          ]}
          value={units}
          onChange={setUnits}
        />
        <Segmented<Sex>
          options={[
            { value: 'male', label: 'גבר' },
            { value: 'female', label: 'אישה' },
          ]}
          value={sex}
          onChange={setSex}
        />
        <Row style={{ gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="שנת לידה" keyboardType="number-pad" value={birthYear} onChangeText={setBirthYear} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="גובה"
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
              suffix={units === 'metric' ? 'ס״מ' : 'אינץ׳'}
            />
          </View>
        </Row>
        <Field label="משקל נוכחי" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} placeholder="למשל 80" suffix={wl} />
        <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>פעילות יומית (בלי אימונים)</Text>
        <Segmented<ActivityLevel>
          options={[
            { value: 'sedentary', label: 'יושבני' },
            { value: 'light', label: 'קלה' },
            { value: 'moderate', label: 'בינונית' },
            { value: 'active', label: 'פעיל' },
          ]}
          value={activity}
          onChange={setActivity}
        />
      </Card>

      <Card>
        <CardHeader title="מטרה" />
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
            <Text style={[font.small, { marginBottom: 8, fontWeight: '600' }]}>קצב (% ממשקל הגוף לשבוע)</Text>
            <Row style={{ gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
              {RATE_PRESETS[goal].map((p) => (
                <Chip key={p.label} label={`${SPEED_HE[p.label] ?? p.label} · ${p.pct}%`} active={p.pct === pct} onPress={() => setPct(p.pct)} />
              ))}
            </Row>
            {weekly != null ? (
              <Text style={[font.small, { marginBottom: spacing.md }]}>
                ≈ {weekly >= 0 ? '+' : '−'}
                {Math.abs(kgToDisplay(weekly, units)).toFixed(2)} {wl} לשבוע · {Math.abs(kgToDisplay(weekly * 4.33, units)).toFixed(1)} {wl} לחודש
              </Text>
            ) : null}
            <Field label="משקל יעד (לא חובה)" keyboardType="decimal-pad" value={goalWeight} onChangeText={setGoalWeight} suffix={wl} />
          </>
        ) : null}
      </Card>

      {error ? <Text style={[font.small, { color: colors.danger, marginBottom: spacing.sm }]}>{error}</Text> : null}
      <Button title="מתחילים" onPress={finish} loading={busy} />
    </Screen>
  );
}
