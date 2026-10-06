import { Pressable, Text, View } from 'react-native';
import type { DailyTotal } from '../db/log';
import { formatDateLabel, formatLongDate, today, weekdayNarrow, type ISODate } from '../lib/dates';
import { colors, font, radius } from '../theme';

export type NutritionMode = 'consumed' | 'remaining';

interface RowSpec {
  key: keyof Omit<DailyTotal, 'date'>;
  color: string;
  target: number;
  letter: string;
  icon?: boolean;
}

const BAR_H = 52;

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
    { key: 'protein', color: colors.protein, target: targets.protein, letter: 'ח' },
    { key: 'fat', color: colors.fat, target: targets.fat, letter: 'ש' },
    { key: 'carbs', color: colors.carbs, target: targets.carbs, letter: 'פ' },
  ];
  const t = today();
  const sel = totals.get(selected);

  return (
    <View>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => {
          const isSel = d === selected;
          const future = d > t;
          const tot = totals.get(d);
          const letter = weekdayNarrow(d);
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={formatLongDate(d)}
              accessibilityState={{ selected: isSel }}
              onPress={() => onSelect(d)}
              style={{
                flex: 1,
                minWidth: 0,
                alignItems: 'center',
                paddingHorizontal: 3,
                paddingTop: 6,
                paddingBottom: 4,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isSel ? colors.primary : 'transparent',
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
                      width: '100%',
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
                          height: Math.max(0, fill * (BAR_H - 8)),
                          backgroundColor: r.color,
                          borderRadius: 2,
                          marginVertical: 4,
                          borderTopWidth: mode === 'consumed' ? 3 : 0,
                          borderBottomWidth: mode === 'remaining' ? 3 : 0,
                          borderColor: colors.text,
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

      <Text style={[font.small, { marginTop: 16, marginBottom: 8 }]}>{formatDateLabel(selected)} · {mode === 'consumed' ? 'נרשם ביומן' : 'נותר ליעד'}</Text>
      {!sel || selected > t ? <Text style={[font.tiny, { marginBottom: 8 }]}>אין רישומי תזונה ליום שנבחר.</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {rows.map(r => {
          const v = sel?.[r.key] ?? 0;
          const shown = mode === 'consumed' ? v : Math.max(0, r.target - v);
          const label = { kcal: 'קלוריות', protein: 'חלבון', fat: 'שומן', carbs: 'פחמימות' }[r.key];
          return <View key={r.key} style={{ width: '47%', flexGrow: 1, backgroundColor: colors.elev2, borderRadius: 12, padding: 10 }}>
            <Text style={[font.small, { color: r.color }]}>{label}</Text>
            <Text style={font.h3}>{sel && selected <= t ? Math.round(shown) : '—'} <Text style={font.tiny}>{r.key === 'kcal' ? 'קק״ל' : 'גרם'}</Text></Text>
            <Text style={font.tiny}>יעד {Math.round(r.target)}</Text>
          </View>;
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
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(m)}
            style={{ paddingVertical: 10, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: active ? colors.primary : 'transparent' }}
          >
            <Text style={{ color: active ? colors.bg : colors.text, fontWeight: '600', fontSize: 14 }}>
              {m === 'consumed' ? 'נאכל' : 'נשאר'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
