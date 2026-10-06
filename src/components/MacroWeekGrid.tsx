import { Text, View } from 'react-native';
import { colors, font, radius } from '../theme';

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

// The week of daily targets, drawn the way MacroFactor shows a program: a calorie pill on top and
// stacked protein / fat / carb blocks sized by how many calories each macro contributes.
export function MacroWeekGrid({
  calories,
  protein,
  fat,
  carbs,
  showDays = true,
  height = 300,
}: {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  showDays?: boolean;
  height?: number;
}) {
  const kcalFrom = { protein: protein * 4, fat: fat * 9, carbs: carbs * 4 };
  const total = Math.max(1, kcalFrom.protein + kcalFrom.fat + kcalFrom.carbs);
  const stackH = height - 46;
  const rows = [
    { key: 'p', label: `${protein} ח`, bg: 'rgba(255,122,92,0.28)', h: (kcalFrom.protein / total) * stackH },
    { key: 'f', label: `${fat} ש`, bg: 'rgba(251,191,36,0.26)', h: (kcalFrom.fat / total) * stackH },
    { key: 'c', label: `${carbs} פ`, bg: 'rgba(34,197,94,0.26)', h: (kcalFrom.carbs / total) * stackH },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {DAY_LETTERS.map((d, i) => (
        <View key={i} style={{ flex: 1 }}>
          <View
            style={{
              backgroundColor: 'rgba(79,141,255,0.3)',
              borderRadius: radius.pill,
              paddingVertical: 5,
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }} numberOfLines={1}>
              {calories}
            </Text>
          </View>
          {rows.map((r) => (
            <View
              key={r.key}
              style={{
                height: Math.max(24, r.h),
                backgroundColor: r.bg,
                borderRadius: 6,
                marginBottom: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                {r.label}
              </Text>
            </View>
          ))}
          {showDays ? <Text style={[font.small, { textAlign: 'center', marginTop: 4 }]}>{d}</Text> : null}
        </View>
      ))}
    </View>
  );
}
