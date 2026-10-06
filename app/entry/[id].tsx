import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  IngredientList,
  keptIngredients,
  sumIngredients,
  toEditable,
  type EditableIngredient,
} from '../../src/components/IngredientList';
import { Button, Card, Field, Row, Screen, Segmented, Stat, parseNum } from '../../src/components/ui';
import { deleteEntry, getEntry, updateEntry } from '../../src/db/log';
import { MEALS, parseComponents, type LogEntry, type Meal } from '../../src/db/types';
import { useApp } from '../../src/state/store';
import { colors, font, spacing } from '../../src/theme';

const MEAL_OPTS = MEALS.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }));

export default function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bump } = useApp();
  const [entry, setEntry] = useState<LogEntry | null>(null);
  const [grams, setGrams] = useState('');
  const [meal, setMeal] = useState<Meal>('snack');
  const [ingredients, setIngredients] = useState<EditableIngredient[] | null>(null);

  useEffect(() => {
    getEntry(Number(id)).then((e) => {
      setEntry(e);
      if (!e) return;
      setGrams(String(Math.round(e.grams)));
      setMeal(e.meal);
      const comps = parseComponents(e.components);
      if (comps) setIngredients(toEditable(comps));
    });
  }, [id]);

  if (!entry) return null;

  const kept = ingredients ? keptIngredients(ingredients) : null;
  const g = parseNum(grams) ?? 0;
  const k = entry.grams > 0 ? g / entry.grams : 0;
  const totals = kept
    ? sumIngredients(kept)
    : { grams: g, kcal: entry.kcal * k, protein: entry.protein * k, carbs: entry.carbs * k, fat: entry.fat * k };

  async function save() {
    if (!entry || totals.grams <= 0) return;
    await updateEntry(entry.id, {
      date: entry.date,
      meal,
      food_id: entry.food_id,
      name: entry.name,
      grams: totals.grams,
      kcal: totals.kcal,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      fiber: kept ? null : entry.fiber != null ? entry.fiber * k : null,
      components: kept ? JSON.stringify(kept) : null,
    });
    bump();
    router.back();
  }

  async function remove() {
    await deleteEntry(entry!.id);
    bump();
    router.back();
  }

  return (
    <Screen>
      <Card>
        <Text style={font.h2}>{entry.name}</Text>
        <Text style={[font.small, { marginBottom: spacing.md }]}>{entry.date}</Text>
        <Segmented<Meal> options={MEAL_OPTS} value={meal} onChange={setMeal} />
        {ingredients ? null : (
          <Field label="Amount" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} suffix="g" selectTextOnFocus />
        )}
        <Row style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <Stat label="Calories" value={`${Math.round(totals.kcal)}`} color={colors.calories} />
          <Stat label="Protein" value={`${Math.round(totals.protein)} g`} color={colors.protein} />
          <Stat label="Carbs" value={`${Math.round(totals.carbs)} g`} color={colors.carbs} />
          <Stat label="Fat" value={`${Math.round(totals.fat)} g`} color={colors.fat} />
        </Row>
      </Card>

      {ingredients ? (
        <Card>
          <Text style={[font.h3, { marginBottom: 4 }]}>Ingredients</Text>
          <Text style={[font.tiny, { marginBottom: spacing.sm }]}>
            Remove anything that was not in your dish, or adjust the grams. Totals update as you edit.
          </Text>
          <IngredientList items={ingredients} onChange={setIngredients} />
        </Card>
      ) : null}

      <Button title="Save" onPress={save} disabled={totals.grams <= 0} />
      <Button title="Delete entry" variant="danger" onPress={remove} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
