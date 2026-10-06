import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Button, Card, Field, Row, Screen, Segmented, Stat, parseNum } from '../../src/components/ui';
import { deleteFood, getFood } from '../../src/db/foods';
import { addEntry } from '../../src/db/log';
import { MEAL_OPTS, MEAL_SHORT, mealForNow, type Food, type Meal } from '../../src/db/types';
import { today } from '../../src/lib/dates';
import { useApp } from '../../src/state/store';
import { colors, font, spacing } from '../../src/theme';


export default function FoodDetail() {
  const { id, date, meal: mealParam } = useLocalSearchParams<{ id: string; date?: string; meal?: string }>();
  const router = useRouter();
  const { bump } = useApp();
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<Meal>((mealParam as Meal) || mealForNow());
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
    router.dismissTo('/(tabs)/nutrition');
  }

  function remove() {
    Alert.alert('מחיקת מזון', 'להסיר את המזון מהמאגר? רישומים קודמים יישארו.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחיקה',
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
              <Text style={font.tiny}>מאגר משרד הבריאות</Text>
            ) : food.barcode ? (
              <Text style={font.tiny}>ברקוד {food.barcode}</Text>
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
              { value: 'servings', label: `מנות (${food.serving_name ? `${food.serving_name} · ` : ''}${food.serving_g} ג׳)` },
              { value: 'grams', label: 'גרמים' },
            ]}
            value={mode}
            onChange={setMode}
          />
        ) : null}
        {mode === 'servings' ? (
          <Field label="מנות" keyboardType="decimal-pad" value={servings} onChangeText={setServings} autoFocus selectTextOnFocus suffix={`= ${Math.round(g)} ג׳`} />
        ) : (
          <Field label="כמות" keyboardType="decimal-pad" value={grams} onChangeText={setGrams} suffix="ג׳" autoFocus selectTextOnFocus />
        )}
        <Row style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <Stat label="קלוריות" value={`${Math.round(food.kcal * k)}`} color={colors.calories} />
          <Stat label="חלבון" value={`${Math.round(food.protein * k)}`} sub="ג׳" color={colors.protein} />
          <Stat label="פחמימה" value={`${Math.round(food.carbs * k)}`} sub="ג׳" color={colors.carbs} />
          <Stat label="שומן" value={`${Math.round(food.fat * k)}`} sub="ג׳" color={colors.fat} />
        </Row>
        <Button title={`הוספה ל${MEAL_SHORT[meal]}`} onPress={add} disabled={g <= 0} />
      </Card>

      <Text style={[font.tiny, { marginBottom: spacing.md }]}>
        ל-100 ג׳: {Math.round(food.kcal)} קק״ל · חלבון {food.protein} · פחמימה {food.carbs} · שומן {food.fat}
        {food.fiber != null ? ` · סיבים ${food.fiber}` : ''}
        {food.sodium_mg != null ? ` · נתרן ${Math.round(food.sodium_mg)} מ״ג` : ''}
      </Text>
      {food.source !== 'moh' ? <Button title="מחיקת המזון" variant="ghost" onPress={remove} /> : null}
    </Screen>
  );
}
