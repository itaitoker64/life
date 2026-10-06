// Run history grouped by week, ported from Stride's HistoryView.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { RunRow } from '../../src/components/run';
import { toast } from '../../src/components/sheet';
import { Button, Card, Screen, SectionTitle } from '../../src/components/ui';
import { addDays, toISODate } from '../../src/lib/dates';
import { R, hasIntervals, syncIntervals, useRun, useRunVersion } from '../../src/run/store';
import type { Activity } from '../../src/run/types';
import { colors, font, spacing } from '../../src/theme';

function weekKey(iso: string) {
  const d = new Date(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
}

export default function RunHistory() {
  useRunVersion();
  const router = useRouter();
  const syncing = useRun((s) => s.syncing);
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    hasIntervals().then(setConnected);
  }, []);

  const month = R.activities.filter((a) => Date.now() - Date.parse(a.start_time) < 30 * 86_400_000);
  const sum = month.reduce((s, a) => ({ km: s.km + a.distance_m / 1000, runs: s.runs + 1, sec: s.sec + a.duration_s }), { km: 0, runs: 0, sec: 0 });
  const groups = new Map<string, Activity[]>();
  for (const a of R.activities) {
    const k = weekKey(a.start_time);
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const thisWeek = weekKey(new Date().toISOString());
  const lastWeek = addDays(thisWeek, -7);

  async function sync() {
    if (!connected) {
      router.push('/settings');
      return;
    }
    try {
      const r = await syncIntervals();
      toast(`סונכרנו ${r.upserted} ריצות מ-intervals.icu`);
    } catch (e) {
      Alert.alert('הסנכרון נכשל', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen bottomInset={false}>
      <Button
        title={connected ? (syncing ? 'מסנכרן…' : 'סנכרון ריצות') : 'חיבור intervals.icu'}
        loading={syncing}
        onPress={sync}
        icon={<Ionicons name="refresh" size={16} color="#fff" />}
      />
      <Card style={{ flexDirection: 'row', marginTop: spacing.md, padding: 0 }}>
        <Sum label="ק״מ ב-30 יום" value={sum.km.toFixed(0)} accent />
        <Sum label="ריצות" value={String(sum.runs)} />
        <Sum label="זמן כולל" value={`${Math.floor(sum.sec / 3600)} ש׳`} />
      </Card>
      {!R.activities.length ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Ionicons name="watch-outline" size={34} color={colors.run} />
          <Text style={[font.h3, { marginTop: spacing.sm }]}>עדיין אין ריצות</Text>
          <Text style={[font.small, { textAlign: 'center' }]}>חברו את Garmin דרך intervals.icu בהגדרות, והריצות יופיעו כאן.</Text>
        </Card>
      ) : null}
      {[...groups.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([start, items]) => {
          const label =
            start === thisWeek
              ? 'השבוע'
              : start === lastWeek
                ? 'שבוע שעבר'
                : `${new Date(start).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} – ${new Date(addDays(start, 6)).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}`;
          const km = items.reduce((x, a) => x + a.distance_m / 1000, 0);
          return (
            <View key={start}>
              <SectionTitle right={<Text style={font.tiny}>{km.toFixed(1)} ק״מ</Text>}>{label}</SectionTitle>
              {items.map((a) => (
                <RunRow key={a.id} a={a} onPress={() => router.push({ pathname: '/run/day/[date]', params: { date: toISODate(new Date(a.start_time)) } })} />
              ))}
            </View>
          );
        })}
    </Screen>
  );
}

function Sum({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: accent ? colors.run : colors.text }}>{value}</Text>
      <Text style={font.tiny}>{label}</Text>
    </View>
  );
}

