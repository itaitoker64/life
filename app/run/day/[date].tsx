// One planned run in full: structure, paces, zone and why (Stride's DayDetail + StructureCard).
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { RunHero, RunRow, ZoneLegend } from '../../../src/components/run';
import { Card, Row, Screen, SectionTitle } from '../../../src/components/ui';
import { toISODate } from '../../../src/lib/dates';
import { WORKOUT_META } from '../../../src/run/format';
import { R, planFor, useRunVersion } from '../../../src/run/store';
import { colors, font, spacing } from '../../../src/theme';

export default function RunDay() {
  useRunVersion();
  const { date } = useLocalSearchParams<{ date: string }>();
  const plan = planFor(date);
  const runs = R.activities.filter((a) => toISODate(new Date(a.start_time)) === date);
  const d = new Date(`${date}T12:00:00`);
  const title = d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!plan) {
    return (
      <Screen bottomInset={false}>
        <Stack.Screen options={{ title }} />
        <Card style={{ alignItems: 'center' }}>
          <Text style={font.small}>עדיין לא נקבע אימון ליום הזה.</Text>
        </Card>
      </Screen>
    );
  }
  const steps = (plan.description ?? '')
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  const meta = WORKOUT_META[plan.workout_type];

  return (
    <Screen bottomInset={false}>
      <Stack.Screen options={{ title }} />
      <RunHero plan={plan} />
      {plan.workout_type !== 'rest' && steps.length ? (
        <>
          <SectionTitle>מבנה האימון</SectionTitle>
          <Card>
            {steps.map((s, i) => {
              const edge = i === 0 || i === steps.length - 1;
              return (
                <Row key={i} style={{ alignItems: 'flex-start', gap: spacing.md, marginBottom: i < steps.length - 1 ? spacing.md : 0 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: edge && steps.length > 1 ? colors.elev2 : meta.color,
                    }}
                  >
                    <Text style={{ color: edge && steps.length > 1 ? colors.muted : '#fff', fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
                  </View>
                  <Text style={[font.body, { flex: 1, lineHeight: 21, paddingTop: 2 }]}>{s}</Text>
                </Row>
              );
            })}
            <ZoneLegend zone={plan.hr_zone} />
          </Card>
        </>
      ) : null}
      <SectionTitle>למה</SectionTitle>
      <Card>
        <Text style={[font.small, { lineHeight: 20 }]}>{plan.rationale}</Text>
      </Card>
      {runs.length ? (
        <>
          <SectionTitle>מה רצת</SectionTitle>
          {runs.map((a) => (
            <RunRow key={a.id} a={a} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
