import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MacroWeekGrid } from '../src/components/MacroWeekGrid';
import { Card, Screen } from '../src/components/ui';
import { acceptProposal, buildProposal, declineProposal, type CheckinProposal } from '../src/lib/coach';
import { kgToDisplay, weightLabel } from '../src/lib/units';
import { useApp } from '../src/state/store';
import { colors, font, radius, shadow, spacing } from '../src/theme';

export default function ProgramUpdate() {
  const router = useRouter();
  const { profile, refreshProfile, bump } = useApp();
  const [proposal, setProposal] = useState<CheckinProposal | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    buildProposal().then(setProposal);
  }, []);

  if (!proposal || !profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={[font.small, { marginTop: spacing.md }]}>בודק את השבוע שלך…</Text>
      </View>
    );
  }

  const units = profile.units;
  const wl = weightLabel(units);
  const { next, deltas, observedWeeklyKg, loggedDays, tdee } = proposal;

  async function accept() {
    setBusy(true);
    await acceptProposal(proposal!);
    await refreshProfile();
    bump();
    router.back();
  }

  async function decline() {
    setBusy(true);
    await declineProposal(proposal!);
    await refreshProfile();
    router.back();
  }

  const changes: Array<{ icon: string; letter?: string; text: React.ReactNode }> = [];
  const line = (label: string, delta: number, unit: string) => (
    <Text style={[font.body, { lineHeight: 21 }]}>
      ה{label} הממוצע{' '}
      <Text style={{ fontWeight: '700' }}>
        {delta === 0 ? 'יישאר ללא שינוי' : `${delta > 0 ? 'יעלה' : 'ירד'} ב-${Math.abs(delta)} ${unit}`}
      </Text>{' '}
      {delta === 0 ? '' : 'בשבוע הבא.'}
    </Text>
  );
  changes.push({ icon: 'flame', text: line('קלוריות', deltas.calories, 'קק״ל') });
  changes.push({ icon: 'P', letter: 'ח', text: line('חלבון', deltas.protein, 'ג׳') });
  changes.push({ icon: 'F', letter: 'ש', text: line('שומן', deltas.fat, 'ג׳') });
  changes.push({ icon: 'C', letter: 'פ', text: line('פחמימות', deltas.carbs, 'ג׳') });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
      <Screen padded={false} style={{ flex: 1 }}>
        <View style={{ backgroundColor: colors.card, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={[font.h2, { marginBottom: spacing.md }]}>התוכנית הבאה</Text>
          <MacroWeekGrid calories={next.calories} protein={next.protein} fat={next.fat} carbs={next.carbs} height={280} />
        </View>

        <View style={{ padding: spacing.lg }}>
          <Text style={[font.h2, { marginBottom: spacing.md }]}>מה השתנה?</Text>
          <Card>
            {changes.map((c, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: 10 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: colors.track,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {c.letter ? (
                    <Text style={{ fontWeight: '800', fontSize: 14, color: colors.text }}>{c.letter}</Text>
                  ) : (
                    <Ionicons name="flame" size={16} color={colors.text} />
                  )}
                </View>
                <View style={{ flex: 1 }}>{c.text}</View>
              </View>
            ))}
          </Card>

          <Text style={[font.h2, { marginTop: spacing.lg, marginBottom: spacing.md }]}>למה</Text>
          <Card>
            <Reason
              label="הוצאה קלורית"
              value={`${tdee} קק״ל ליום`}
              desc={`הוערכה מחדש ממגמת המשקל ומ-${loggedDays} הימים שרשמת בשלושת השבועות האחרונים.`}
            />
            <Reason
              label="שינוי בפועל"
              value={
                observedWeeklyKg != null
                  ? `${observedWeeklyKg >= 0 ? '+' : '−'}${Math.abs(kgToDisplay(observedWeeklyKg, units)).toFixed(2)} ${wl} לשבוע`
                  : 'אין מספיק נתונים'
              }
              desc="קצב השינוי בפועל בשלושת השבועות האחרונים, לפי מגמת המשקל."
            />
            <Reason
              label="יעד חדש"
              value={`${next.calories} קק״ל ליום`}
              desc="ההוצאה ועוד הגירעון או העודף שהמטרה דורשת, מוחלק כך שהיעדים זזים בהדרגה ולא עוקבים אחרי כל תנודה שבועית."
              last
            />
            {loggedDays < 7 ? (
              <Text style={[font.tiny, { marginTop: spacing.md, color: colors.warning }]}>
                פחות מ-7 ימים מלאים, ולכן ההערכה כמעט לא זזה. רישום של יותר ימים ייתן תוכנית מדויקת יותר.
              </Text>
            ) : null}
          </Card>
        </View>
      </Screen>

      <View style={{ padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.bg }}>
        <Pressable
          onPress={decline}
          disabled={busy}
          style={({ pressed }) => ({
            backgroundColor: colors.elev2,
            borderRadius: radius.md,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed || busy ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>לדחות</Text>
        </Pressable>
        <Pressable
          onPress={accept}
          disabled={busy}
          style={({ pressed }) => ({
            backgroundColor: colors.black,
            borderRadius: radius.md,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed || busy ? 0.8 : 1,
            ...shadow,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>לאשר את השינויים</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Reason({ label, value, desc, last }: { label: string; value: string; desc: string; last?: boolean }) {
  return (
    <View style={{ paddingBottom: last ? 0 : spacing.md, marginBottom: last ? 0 : spacing.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={font.label}>{label}</Text>
        <Text style={[font.body, { fontWeight: '700' }]}>{value}</Text>
      </View>
      <Text style={[font.small, { marginTop: 4, lineHeight: 18 }]}>{desc}</Text>
    </View>
  );
}
