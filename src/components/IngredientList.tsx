import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { EntryComponent } from '../db/types';
import { colors, font, radius, spacing } from '../theme';
import { parseNum } from './ui';

export interface EditableIngredient extends EntryComponent {
  gramsText: string;
  removed: boolean;
}

export function toEditable(list: EntryComponent[]): EditableIngredient[] {
  return list.map((i) => ({ ...i, gramsText: String(Math.round(i.grams)), removed: false }));
}

// Nutrients scale linearly with the grams the user types; the original estimate is the reference.
export function scaleIngredient(i: EditableIngredient): EntryComponent {
  const g = parseNum(i.gramsText) ?? 0;
  const k = i.grams > 0 ? g / i.grams : 0;
  return { name: i.name, grams: g, kcal: i.kcal * k, protein: i.protein * k, carbs: i.carbs * k, fat: i.fat * k };
}

export function keptIngredients(list: EditableIngredient[]): EntryComponent[] {
  return list.filter((i) => !i.removed).map(scaleIngredient).filter((i) => i.grams > 0);
}

export function sumIngredients(list: EntryComponent[]) {
  return list.reduce(
    (a, i) => ({
      grams: a.grams + i.grams,
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function IngredientList({
  items,
  onChange,
}: {
  items: EditableIngredient[];
  onChange: (items: EditableIngredient[]) => void;
}) {
  const update = (idx: number, patch: Partial<EditableIngredient>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <View>
      {items.map((it, idx) => {
        const s = scaleIngredient(it);
        return (
          <View
            key={`${it.name}-${idx}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: 8,
              borderTopWidth: idx ? 1 : 0,
              borderTopColor: colors.border,
              opacity: it.removed ? 0.4 : 1,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[font.body, { fontSize: 14, textDecorationLine: it.removed ? 'line-through' : 'none' }]}
                numberOfLines={1}
              >
                {it.name}
              </Text>
              <Text style={font.tiny}>
                {Math.round(s.kcal)} קק״ל · ח {Math.round(s.protein)} · פ {Math.round(s.carbs)} · ש {Math.round(s.fat)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.elev2,
                borderRadius: radius.sm,
                paddingHorizontal: 8,
                width: 72,
              }}
            >
              <TextInput
                style={{ flex: 1, paddingVertical: 6, fontSize: 14, color: colors.text, textAlign: 'center' }}
                keyboardType="decimal-pad"
                value={it.gramsText}
                editable={!it.removed}
                onChangeText={(t) => update(idx, { gramsText: t })}
                selectTextOnFocus
              />
              <Text style={[font.tiny, { marginStart: 2 }]}>ג׳</Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => update(idx, { removed: !it.removed })}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: it.removed ? colors.primarySoft : colors.dangerSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={it.removed ? 'arrow-undo' : 'close'} size={16} color={it.removed ? colors.text : colors.danger} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
