import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { Sparkline } from './charts';
import { Card } from './ui';
import type { PeriodChange, RangeKey } from '../lib/series';
import { colors, font, radius, spacing } from '../theme';

export function RangeSelector({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  const opts: RangeKey[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.track, borderRadius: radius.pill, padding: 4 }}>
      {opts.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: radius.pill,
              alignItems: 'center',
              backgroundColor: active ? colors.black : 'transparent',
            }}
          >
            <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>{o === 'ALL' ? 'All' : o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string; kind: 'line' | 'band' | 'square' | 'faint' }> }) {
  return (
    <Card style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.md }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {it.kind === 'band' ? (
            <View style={{ width: 22, height: 14, backgroundColor: it.color, opacity: 0.35, borderRadius: 3 }} />
          ) : it.kind === 'square' ? (
            <View style={{ width: 10, height: 10, borderWidth: 2, borderColor: it.color }} />
          ) : it.kind === 'faint' ? (
            <View style={{ width: 22, height: 3, backgroundColor: it.color, opacity: 0.35, borderRadius: 2 }} />
          ) : (
            <View style={{ width: 22, height: 10, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: 22, height: 3, backgroundColor: it.color, borderRadius: 2 }} />
              <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: it.color, backgroundColor: '#fff' }} />
            </View>
          )}
          <Text style={[font.small, { color: colors.text, fontWeight: '600' }]}>{it.label}</Text>
        </View>
      ))}
    </Card>
  );
}

export function ChangesTable({
  title,
  changes,
  color,
  unit,
  decimals,
  threshold,
}: {
  title: string;
  changes: PeriodChange[];
  color: string;
  unit: string;
  decimals: number;
  threshold: number;
}) {
  return (
    <Card>
      <Text style={[font.h3, { marginBottom: spacing.md }]}>{title}</Text>
      {changes.map((c) => {
        const dir = c.delta == null ? null : Math.abs(c.delta) < threshold ? 'flat' : c.delta > 0 ? 'up' : 'down';
        return (
          <View key={c.days} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <Text style={[font.small, { width: 56 }]}>{c.days}-day</Text>
            <Sparkline values={c.spark} color={color} width={72} height={30} />
            <Text style={[font.body, { fontWeight: '600', width: 84, marginLeft: spacing.sm, fontSize: 14 }]}>
              {c.delta == null ? '—' : `${c.delta > 0 ? '' : c.delta < 0 ? '-' : ''}${Math.abs(c.delta).toFixed(decimals)} ${unit}`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              {dir ? (
                <Ionicons
                  name={dir === 'up' ? 'trending-up' : dir === 'down' ? 'trending-down' : 'arrow-forward'}
                  size={14}
                  color={color}
                />
              ) : null}
              <Text style={font.small} numberOfLines={1}>
                {dir === 'up' ? 'Increase' : dir === 'down' ? 'Decrease' : dir === 'flat' ? 'No Change' : 'Not enough data'}
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export function InfoBox({ value, unit, title, desc }: { value: string; unit?: string; title: string; desc: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg }}>
      <View
        style={{
          width: 116,
          minHeight: 96,
          backgroundColor: colors.bg,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.sm,
        }}
      >
        <Text style={[font.h1, { fontSize: value.length > 6 ? 20 : 26, textAlign: 'center' }]}>{value}</Text>
        {unit ? <Text style={[font.tiny, { textAlign: 'center' }]}>{unit}</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={font.h3}>{title}</Text>
        <Text style={[font.small, { marginTop: 4, lineHeight: 19 }]}>{desc}</Text>
      </View>
    </View>
  );
}

export function StatHeader({
  average,
  difference,
  unit,
  range,
  decimals,
}: {
  average: number | null;
  difference: number | null;
  unit: string;
  range: string;
  decimals: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.md }}>
      <View>
        <Text style={font.small}>Average</Text>
        <Text style={[font.display, { fontSize: 30 }]}>
          {average != null ? average.toFixed(decimals) : '—'}
          <Text style={[font.small, { fontWeight: '500' }]}> {unit}</Text>
        </Text>
        <Text style={font.small}>{range}</Text>
      </View>
      <View>
        <Text style={font.small}>Difference</Text>
        <Text style={[font.display, { fontSize: 30 }]}>
          {difference != null ? `${difference < 0 ? '-' : ''}${Math.abs(difference).toFixed(decimals)}` : '—'}
          <Text style={[font.small, { fontWeight: '500' }]}> {unit}</Text>
        </Text>
      </View>
    </View>
  );
}

export function SectionHeading({ children }: { children: string }) {
  return <Text style={[font.h2, { fontSize: 20, marginTop: spacing.lg, marginBottom: spacing.md }]}>{children}</Text>;
}
