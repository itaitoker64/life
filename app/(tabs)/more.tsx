import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, Field, Screen, SectionTitle, Segmented, Title, parseNum } from '../../src/components/ui';
import { getDb } from '../../src/db';
import { aiUsageSummary } from '../../src/db/usage';
import { applyTargets, updateExpenditureIfNeeded } from '../../src/lib/coach';
import { clearApiKey, getApiKey, setApiKey } from '../../src/lib/secrets';
import type { ActivityLevel, Sex } from '../../src/lib/tdee';
import type { Units } from '../../src/lib/units';
import { useApp } from '../../src/state/store';
import { colors, font, spacing } from '../../src/theme';

export default function More() {
  const { profile, patchProfile, refreshProfile, init } = useApp();
  const router = useRouter();
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [height, setHeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof aiUsageSummary>> | null>(null);

  useFocusEffect(
    useCallback(() => {
      getApiKey().then((k) => setHasKey(!!k));
      aiUsageSummary().then(setUsage);
    }, []),
  );

  useEffect(() => {
    if (!profile) return;
    setHeight(String(Math.round(profile.height_cm)));
    setBirthYear(String(profile.birth_year));
  }, [profile?.height_cm, profile?.birth_year]);

  if (!profile) return null;

  async function saveKey() {
    const k = key.trim();
    if (!k) return;
    if (!k.startsWith('sk-ant-')) {
      Alert.alert('Not an Anthropic key', 'Anthropic API keys start with sk-ant-');
      return;
    }
    await setApiKey(k);
    const stored = await getApiKey();
    setKey('');
    setHasKey(!!stored);
    Alert.alert(stored ? 'Saved' : 'Not saved', stored ? 'API key stored securely on this device.' : 'Could not save the key. Try again.');
  }

  async function removeKey() {
    await clearApiKey();
    setHasKey(false);
  }

  async function saveBody() {
    const h = parseNum(height);
    const y = parseNum(birthYear);
    await patchProfile({ height_cm: h ?? profile!.height_cm, birth_year: y ?? profile!.birth_year });
    await applyTargets();
    await refreshProfile();
  }

  function resetAll() {
    Alert.alert('Reset all data', 'This deletes your food log, weights, custom foods and settings. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await db.execAsync(`
            DELETE FROM food_log; DELETE FROM weight_entries; DELETE FROM expenditure_history;
            DELETE FROM foods WHERE source NOT IN ('moh'); DELETE FROM settings;
            UPDATE profile SET onboarded = 0, program_start = NULL, last_checkin = NULL, last_expenditure_update = NULL WHERE id = 1;
          `);
          await init();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Title>More</Title>

      <Card style={{ padding: 0 }}>
        <LinkRow icon="scale-outline" color={colors.weight} title="Weight Trend" sub="Trend, changes, projections" onPress={() => router.push('/weight')} />
        <LinkRow
          icon="flame-outline"
          color={colors.expenditure}
          title="Expenditure"
          sub="Daily energy expenditure history"
          onPress={() => router.push('/expenditure')}
          last
        />
      </Card>

      <SectionTitle>AI (Anthropic API key)</SectionTitle>
      <Card>
        <Text style={[font.small, { marginBottom: spacing.md }]}>
          Used only for meal photos and reading a nutrition label. Barcode scans, search and everything else never touch the
          API. {hasKey ? 'A key is currently saved.' : 'No key saved.'}
        </Text>
        <Field placeholder="sk-ant-..." value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <Button title={hasKey ? 'Replace key' : 'Save key'} onPress={saveKey} />
        {hasKey ? <Button title="Remove key" variant="ghost" onPress={removeKey} style={{ marginTop: spacing.sm }} /> : null}
      </Card>

      <SectionTitle>AI usage</SectionTitle>
      <Card>
        {usage && usage.all.calls > 0 ? (
          <>
            <UsageRow label="This month" b={usage.month} />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
            <UsageRow label="All time" b={usage.all} />
            <Text style={[font.tiny, { marginTop: spacing.sm }]}>
              Average ${(usage.all.cost / usage.all.calls).toFixed(4)} per call. Estimated from token counts; your Anthropic
              console shows the exact bill.
            </Text>
          </>
        ) : (
          <Text style={font.small}>No AI calls recorded yet. Every photo or label read will show up here with its cost.</Text>
        )}
      </Card>

      <SectionTitle>Body</SectionTitle>
      <Card>
        <Segmented<Sex>
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
          value={profile.sex}
          onChange={(sex) => patchProfile({ sex })}
        />
        <Field label="Height (cm)" keyboardType="number-pad" value={height} onChangeText={setHeight} />
        <Field label="Birth year" keyboardType="number-pad" value={birthYear} onChangeText={setBirthYear} />
        <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>Activity (outside of exercise)</Text>
        <Segmented<ActivityLevel>
          options={[
            { value: 'sedentary', label: 'Sedentary' },
            { value: 'light', label: 'Light' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'active', label: 'Active' },
          ]}
          value={profile.activity === 'very_active' ? 'active' : profile.activity}
          onChange={(activity) => patchProfile({ activity })}
        />
        <Button title="Save" onPress={saveBody} />
      </Card>

      <SectionTitle>Units</SectionTitle>
      <Card>
        <Segmented<Units>
          options={[
            { value: 'metric', label: 'kg / cm' },
            { value: 'imperial', label: 'lb / ft' },
          ]}
          value={profile.units}
          onChange={(units) => patchProfile({ units })}
        />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card>
        <Button
          title="Recalculate expenditure now"
          variant="secondary"
          onPress={async () => {
            await updateExpenditureIfNeeded(true);
            await refreshProfile();
          }}
        />
        <Button title="Reset all data" variant="danger" onPress={resetAll} style={{ marginTop: spacing.sm }} />
      </Card>
    </Screen>
  );
}

function UsageRow({ label, b }: { label: string; b: import('../../src/db/usage').UsageBucket }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View>
        <Text style={font.h3}>{label}</Text>
        <Text style={font.small}>
          {b.photos} photo{b.photos === 1 ? '' : 's'} · {b.labels} label{b.labels === 1 ? '' : 's'} ·{' '}
          {((b.input + b.output) / 1000).toFixed(1)}k tokens
        </Text>
      </View>
      <Text style={[font.h2, { fontSize: 18 }]}>${b.cost.toFixed(3)}</Text>
    </View>
  );
}

function LinkRow({
  icon,
  color,
  title,
  sub,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.bg : 'transparent',
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={font.h3}>{title}</Text>
        <Text style={font.small}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}
