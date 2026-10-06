import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, Field, Row, Screen, Segmented, Stat, parseNum } from '../../src/components/ui';
import { deleteFood, getFood } from '../../src/db/foods';
import { addEntry } from '../../src/db/log';
import { MEALS, type Food, type Meal } from '../../src/db/types';
import { today } from '../../src/lib/dates';
import { useApp } from '../../src/state/store';
import { colors, font, spacing } from '../../src/theme';

const MEAL_OPTS = MEALS.map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) }));

export default function FoodDetail() {
  const { id, date, meal: mealParam } = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const router = useRouter();
  const { bump } = useApp();
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<Meal>((mealParam as Meal) || 'snack');
  const [mode, setMode] = useState<'grams' | 'servings'>('grams');
  const [servings, setServings] = useState('1');

  useEffect(() => {
    getFood(Number(id)).then((f) => {
      setFood(f);
      if (f?.serving_g) {
        setMode('servings');
        setGrams(String(f.serving_g));
      }
    });
  }, [id]);

  if (!food) return null;

  const g = mode === 'servings' ? (parseNum(servings) ?? 0) * (food.serving_g ?? 100) : (parseNum(grams) ?? 0);
  const k = g / 100;

  async function add() {
    if (!food || g <= 0) return;
    await addEntry({
      date: date || today(),
      meal,
      food_id: food.id,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      grams: g,
      kcal: food.kcal * k,
      protein: food.protein * k,
      carbs: food.carbs * k,
      fat: food.fat * k,
      fiber: food.fiber != null ? food.fiber * k : null,
    });
    bump();
    router.dismissTo('/(tabs)/log');
  }

  function remove() {
    Alert.alert('Delete food', 'Remove this food from your database? Past log entries stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFood(food!.id);
          bump();
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={font.h2}>{food.name}</Text>
            {food.name_en ? <Text style={font.small}>{food.name_en}</Text> : null}
            {food.brand ? <Text style={font.small}>{food.brand}</Text> : null}
            {food.source === 'moh' ? (
              <Text style={font.tiny}>Israeli Ministry of Health database</Text>
            ) : food.barcode ? (
              <Text style={font.tiny}>Barcode {food.barcode}</Text>
            ) : null}
          </View>
          <Pressable
            hitSlop={10}
            onPress={() => router.push({ pathname: '/food/new', params: { id: String(food.id), date, meal } })}
          >
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </Pressable>
        </Row>
      </Card>

      <Card>
        <Segmented<Meal> options={MEAL_OPTS} value={meal} onChange={setMeal} />
        {food.serving_g ? (
          <Segmented<'grams' | 'servings'>
            options={[
              { value: 'servings', label: `Servings (${food.serving_name ?? `${food.serving_g} g`})` },
              { value: 'grams', label: 'Grams' },
            ]}
            value={mode}
            onChange={setMode}
          />
        ) : null}
        {mode === 'servings' ? (
          <Field label="Servings" keyboardType="decimal-pad" value={servings} onChangeText={setServings} autoFocus selectTextOnFocus />
        ) : (
          <Field label="Amount" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} suffix="g" autoFocus selectTextOnFocus />
        )}
        <Row style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <Stat label="Calories" value={`${Math.round(food.kcal * k)}`} color={colors.calories} />
          <Stat label="Protein" value={`${Math.round(food.protein * k)} g`} color={colors.protein} />
          <Stat label="Carbs" value={`${Math.round(food.carbs * k)} g`} color={colors.carbs} />
          <Stat label="Fat" value={`${Math.round(food.fat * k)} g`} color={colors.fat} />
        </Row>
        <Button title={`Add to ${meal}`} onPress={add} disabled={g <= 0} />
      </Card>

      <Text style={[font.tiny, { marginBottom: spacing.md }]}>
        Per 100 g: {Math.round(food.kcal)} kcal · P {food.protein} · C {food.carbs} · F {food.fat}
        {food.fiber != null ? ` · fiber ${food.fiber}` : ''}
        {food.sodium_mg != null ? ` · sodium ${Math.round(food.sodium_mg)} mg` : ''}
      </Text>
      {food.source !== 'moh' ? <Button title="Delete food" variant="ghost" onPress={remove} /> : null}
    </Screen>
  );
}
