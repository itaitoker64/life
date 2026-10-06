import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { TrendChart } from '../src/components/charts';
import { ChangesTable, InfoBox, Legend, RangeSelector, SectionHeading, StatHeader } from '../src/components/insights';
import { RulerPicker } from '../src/components/RulerPicker';
import { Button, Card, CardHeader, Row, Screen } from '../src/components/ui';
import type { WeightEntry } from '../src/db/types';
import { allWeights, deleteWeight, upsertWeight, weightForDate } from '../src/db/weight';
import { weightInsights, weightSeries, type WeightSeries } from '../src/lib/analytics';
import { updateExpenditureIfNeeded } from '../src/lib/coach';
import { addDays, formatDateLabel, formatShortDate, today } from '../src/lib/dates';
import { Ionicons } from '@expo/vector-icons';
import { RANGE_DAYS, axisLabels, firstLast, formatRange, mean, periodChanges, type RangeKey } from '../src/lib/series';
import { displayToKg, fmtWeight, kgToDisplay, weightLabel } from '../src/lib/units';
import { useApp } from '../src/state/store';
import { chevronBack, chevronForward, colors, font, spacing } from '../src/theme';

export default function Weight() {
  const { profile, bump, version, refreshProfile } = useApp();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('1W');
  const [series, setSeries] = useState<WeightSeries | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [value, setValue] = useState<number | null>(null);
  const [base, setBase] = useState<number | null>(null);
  const [logDate, setLogDate] = useState(today());
  const [savedForDate, setSavedForDate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const units = profile?.units ?? 'metric';
  const wl = weightLabel(units);
  const disp = (kg: number) => kgToDisplay(kg, units);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [s, all, t] = await Promise.all([weightSeries(RANGE_DAYS[range]), allWeights(), weightForDate(logDate)]);
        setSeries(s);
        setEntries(all);
        const last = all.length ? all[all.length - 1].weight_kg : null;
        const initial = +disp(t?.weight_kg ?? last ?? 75).toFixed(1);
        setSavedForDate(t?.weight_kg ?? null);
        setBase((b) => b ?? initial);
        setValue(t ? +disp(t.weight_kg).toFixed(1) : (v) => v ?? initial);
      })();
    }, [range, version, units, logDate]),
  );

  if (!profile) return null;

  async function save() {
    if (value == null) return;
    setSaving(true);
    const kg = displayToKg(value, units);
    await upsertWeight(logDate, kg);
    setSavedForDate(kg);
    await updateExpenditureIfNeeded(true);
    await refreshProfile();
    bump();
    setSaving(false);
  }

  function confirmDelete(e: WeightEntry) {
    Alert.alert('מחיקת שקילה', `${formatShortDate(e.date)}: ${fmtWeight(e.weight_kg, units)}`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: async () => {
          await deleteWeight(e.id);
          bump();
        },
      },
    ]);
  }

  const trendDisp = series ? series.trend.map((v) => (v == null ? null : disp(v))) : [];
  const [first, last] = firstLast(trendDisp);
  const avg = mean(trendDisp);
  const changes = series ? periodChanges(series.all.map((v) => (v == null ? null : disp(v))), [7, 14, 30, 90]) : [];
  const ins = series ? weightInsights(series.all) : null;
  const chartW = width - spacing.lg * 2;
  const isDirty = value != null && (savedForDate == null || Math.abs(disp(savedForDate) - value) > 0.01);
  const gaining = (ins?.weeklyChangeKg ?? 0) >= 0;

  return (
    <Screen padded={false}>
      <View style={{ padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <StatHeader
          average={avg}
          difference={first != null && last != null ? last - first : null}
          unit={wl}
          range={series && series.dates.length ? formatRange(series.dates[0], series.dates[series.dates.length - 1]) : ''}
          decimals={1}
        />
        {series && series.dates.length ? (
          <TrendChart
            width={chartW}
            height={300}
            color={colors.weight}
            rawColor={colors.weightSoft}
            decimals={1}
            points={series.dates.map((_, i) => ({
              trend: trendDisp[i],
              raw: series.raw[i] == null ? null : disp(series.raw[i]!),
            }))}
            labels={axisLabels(series.dates)}
          />
        ) : (
          <Text style={[font.small, { paddingVertical: spacing.xl }]}>רשמו שקילה ראשונה כדי לראות את המגמה.</Text>
        )}
        <View style={{ marginTop: spacing.md }}>
          <RangeSelector value={range} onChange={setRange} />
        </View>
      </View>

      <View style={{ padding: spacing.lg }}>
        <Legend
          items={[
            { label: 'שקילה בפועל', color: colors.weight, kind: 'faint' },
            { label: 'מגמת משקל', color: colors.weight, kind: 'line' },
          ]}
        />

        <Card>
          <CardHeader
            title="רישום משקל"
            subtitle={savedForDate != null ? `נשמר ${fmtWeight(savedForDate, units)} ליום הזה` : 'עוד לא נשמר משקל ליום הזה'}
            color={colors.weight}
            right={
              <Row style={{ gap: spacing.xs }}>
                <Pressable onPress={() => setLogDate(addDays(logDate, -1))} hitSlop={8} style={navBtn}>
                  <Ionicons name={chevronBack} size={18} color={colors.text} />
                </Pressable>
                <Text style={[font.small, { color: colors.text, fontWeight: '700', minWidth: 70, textAlign: 'center' }]}>
                  {formatDateLabel(logDate)}
                </Text>
                <Pressable
                  onPress={() => logDate < today() && setLogDate(addDays(logDate, 1))}
                  hitSlop={8}
                  style={[navBtn, { opacity: logDate < today() ? 1 : 0.3 }]}
                >
                  <Ionicons name={chevronForward} size={18} color={colors.text} />
                </Pressable>
              </Row>
            }
          />
          {value != null && base != null ? (
            <RulerPicker
              min={Math.max(20, Math.floor(base - 25))}
              max={Math.ceil(base + 25)}
              step={0.1}
              decimals={1}
              unit={wl}
              value={value}
              onChange={setValue}
              color={colors.weight}
            />
          ) : null}
          <Button
            title={savedForDate == null ? `שמירה ל${formatDateLabel(logDate)}` : isDirty ? 'עדכון השקילה' : 'נשמר'}
            onPress={save}
            loading={saving}
            disabled={!isDirty}
            style={{ marginTop: spacing.md }}
          />
          <Text style={[font.tiny, { marginTop: spacing.sm }]}>
            ברירת המחדל היא היום. החצים מאפשרים להוסיף או לתקן שקילה קודמת; לכל יום נשמר משקל אחד.
          </Text>
        </Card>

        <SectionHeading>תובנות ונתונים</SectionHeading>
        <ChangesTable title="שינויים במשקל" changes={changes} color={colors.weight} unit={wl} decimals={1} threshold={0.05} />

        <Card>
          <InfoBox
            value={ins?.currentKg != null ? disp(ins.currentKg).toFixed(1) : '—'}
            unit={wl}
            title="משקל נוכחי"
            desc="ההערכה שלנו למשקל האמיתי שלך, אחרי החלקת התנודות היומיות."
          />
          <InfoBox
            value={ins?.weeklyChangeKg != null ? Math.abs(disp(ins.weeklyChangeKg)).toFixed(2) : '—'}
            unit={`${wl} לשבוע`}
            title="שינוי שבועי במשקל"
            desc={`קצב ה${gaining ? 'עלייה' : 'ירידה'} השבועי שלך בשלושת השבועות האחרונים.`}
          />
          <InfoBox
            value={ins?.energyPerDay != null ? `${Math.round(Math.abs(ins.energyPerDay))}` : '—'}
            unit="קק״ל ליום"
            title={gaining ? 'עודף קלורי' : 'גירעון קלורי'}
            desc={`הערכה ל${gaining ? 'עודף' : 'גירעון'} הקלורי היומי הממוצע שלך, לפי קצב ה${gaining ? 'עלייה' : 'ירידה'} במשקל בשלושת השבועות האחרונים.`}
          />
          <InfoBox
            value={ins?.projection30Kg != null ? disp(ins.projection30Kg).toFixed(1) : '—'}
            unit={wl}
            title="תחזית ל-30 יום"
            desc={`המשקל הצפוי בעוד 30 יום אם קצב ה${gaining ? 'עלייה' : 'ירידה'} הנוכחי יימשך.`}
          />
        </Card>

        <Card style={{ padding: 0 }}>
          {[...entries].reverse().slice(0, 30).map((e, i) => (
            <Pressable
              key={e.id}
              onLongPress={() => confirmDelete(e)}
              style={{ padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={font.body}>{formatShortDate(e.date)}</Text>
                <Text style={[font.body, { fontWeight: '700' }]}>{fmtWeight(e.weight_kg, units)}</Text>
              </Row>
            </Pressable>
          ))}
          {entries.length === 0 ? <Text style={[font.small, { padding: spacing.md }]}>עדיין אין שקילות.</Text> : null}
        </Card>
        <Text style={[font.tiny, { textAlign: 'center' }]}>לחיצה ארוכה על שקילה כדי למחוק</Text>
      </View>
    </Screen>
  );
}

const navBtn = {
  width: 30,
  height: 30,
  borderRadius: 15,
  backgroundColor: colors.elev2,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
