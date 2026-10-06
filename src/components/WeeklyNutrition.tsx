import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { DailyTotal } from '../db/log';
import { parseISODate, today, type ISODate } from '../lib/dates';
import { colors, font, radius, spacing } from '../theme';

export type NutritionMode = 'consumed' | 'remaining';

interface RowSpec {
  key: keyof Omit<DailyTotal, 'date'>;
  color: string;
  target: number;
  letter: string;
  icon?: boolean;
}

const BAR_H = 52;
const BAR_W = 30;

export function WeeklyNutrition({
  days,
  totals,
  selected,
  onSelect,
  targets,
  mode,
}: {
  days: ISODate[];
  totals: Map<ISODate, DailyTotal>;
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  targets: { kcal: number; protein: number; fat: number; carbs: number };
  mode: NutritionMode;
}) {
  const rows: RowSpec[] = [
    { key: 'kcal', color: colors.calories, target: targets.kcal, letter: '', icon: true },
    { key: 'protein', color: colors.protein, target: targets.protein, letter: 'P' },
    { key: 'fat', color: colors.fat, target: targets.fat, letter: 'F' },
    { key: 'carbs', color: colors.carbs, target: targets.carbs, letter: 'C' },
  ];
  const t = today();
  const sel = totals.get(selected);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => {
          const isSel = d === selected;
          const future = d > t;
          const tot = totals.get(d);
          const letter = parseISODate(d).toLocaleDateString('en-US', { weekday: 'narrow' });
          return (
            <Pressable
              key={d}
              onPress={() => onSelect(d)}
              style={{
                alignItems: 'center',
                paddingHorizontal: 4,
                paddingTop: 6,
                paddingBottom: 4,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isSel ? colors.black : 'transparent',
              }}
            >
              {rows.map((r, i) => {
                const v = tot?.[r.key] ?? 0;
                const has = !!tot && !future;
                const ratio = r.target > 0 ? Math.min(1, v / r.target) : 0;
                const fill = mode === 'consumed' ? ratio : Math.max(0, 1 - ratio);
                return (
                  <View
                    key={r.key}
                    style={{
                      width: BAR_W,
                      height: BAR_H,
                      backgroundColor: colors.track,
                      borderRadius: 4,
                      marginBottom: i < rows.length - 1 ? 10 : 0,
                      overflow: 'hidden',
                      justifyContent: mode === 'consumed' ? 'flex-end' : 'flex-start',
                      alignItems: 'center',
                    }}
                  >
                    {has ? (
                      <View
                        style={{
                          width: 10,
                          height: Math.max(3, fill * (BAR_H - 8)),
                          backgroundColor: r.color,
                          borderRadius: 2,
                          marginVertical: 4,
                          borderTopWidth: mode === 'consumed' ? 3 : 0,
                          borderBottomWidth: mode === 'remaining' ? 3 : 0,
                          borderColor: colors.black,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 10,
                          height: 3,
                          backgroundColor: colors.faint,
                          opacity: 0.6,
                          borderRadius: 2,
                          marginVertical: 4,
                        }}
                      />
                    )}
                  </View>
                );
              })}
              <Text style={[font.small, { marginTop: 8, fontWeight: isSel ? '800' : '500', color: isSel ? colors.text : colors.muted }]}>
                {letter}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ width: 74, paddingLeft: spacing.sm, paddingTop: 4 }}>
        {rows.map((r, i) => {
          const v = sel?.[r.key] ?? 0;
          const shown = mode === 'consumed' ? v : Math.max(0, r.target - v);
          return (
            <View key={r.key} style={{ height: BAR_H, marginBottom: i < rows.length - 1 ? 10 : 0, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {Math.round(shown)}
                </Text>
                {r.icon ? (
                  <Ionicons name="flame" size={11} color={colors.muted} style={{ marginLeft: 2 }} />
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, marginLeft: 3 }}>{r.letter}</Text>
                )}
              </View>
              <Text style={font.tiny}>of {Math.round(r.target)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function ModeToggle({ value, onChange }: { value: NutritionMode; onChange: (m: NutritionMode) => void }) {
  return (
    <View style={{ alignSelf: 'center', flexDirection: 'row', backgroundColor: colors.track, borderRadius: radius.pill, padding: 4 }}>
      {(['consumed', 'remaining'] as NutritionMode[]).map((m) => {
        const active = m === value;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={{ paddingVertical: 10, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: active ? colors.black : 'transparent' }}
          >
            <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 14 }}>
              {m === 'consumed' ? 'Consumed' : 'Remaining'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
