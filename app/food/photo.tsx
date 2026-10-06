import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { ApiKeyPrompt } from '../../src/components/ApiKeyPrompt';
import {
  IngredientList,
  keptIngredients,
  sumIngredients,
  toEditable,
  type EditableIngredient,
} from '../../src/components/IngredientList';
import { Button, Card, Field, Row, Screen, Segmented, Stat } from '../../src/components/ui';
import { addEntry } from '../../src/db/log';
import { MEAL_OPTS, MEAL_SHORT, mealForNow, type Meal } from '../../src/db/types';
import { MissingApiKeyError, analyzeFoodPhoto, describeAiError, hasApiKey, type ImageAsset } from '../../src/lib/ai';
import { today } from '../../src/lib/dates';
import { useApp } from '../../src/state/store';
import { colors, font, spacing } from '../../src/theme';


interface EditableDish {
  name: string;
  confidence: 'low' | 'medium' | 'high';
  include: boolean;
  ingredients: EditableIngredient[];
}

export default function Photo() {
  const { date, meal: mealParam } = useLocalSearchParams<{ date: string; meal: string }>();
  const router = useRouter();
  const { bump } = useApp();
  const [image, setImage] = useState<ImageAsset | null>(null);
  const uri = image?.uri ?? null;
  const [hint, setHint] = useState('');
  const [dishes, setDishes] = useState<EditableDish[] | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [meal, setMeal] = useState<Meal>((mealParam as Meal) || mealForNow());
  const [keyReady, setKeyReady] = useState<boolean | null>(null);

  useEffect(() => {
    hasApiKey().then(setKeyReady);
  }, []);

  async function pick(fromCamera: boolean) {
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled) return;
    const a = res.assets[0];
    setImage({ uri: a.uri, width: a.width, height: a.height });
    setDishes(null);
    setError('');
  }

  async function analyze() {
    if (!image) return;
    setBusy(true);
    setError('');
    try {
      const result = await analyzeFoodPhoto(image, hint);
      setDishes(
        result.dishes.map((d) => ({
          name: d.name,
          confidence: d.confidence,
          include: true,
          ingredients: toEditable(
            d.ingredients.map((i) => ({
              name: i.name,
              grams: i.grams,
              kcal: i.kcal,
              protein: i.protein_g,
              carbs: i.carbs_g,
              fat: i.fat_g,
            })),
          ),
        })),
      );
      setNotes(result.notes);
    } catch (e) {
      if (e instanceof MissingApiKeyError) setKeyReady(false);
      else setError(describeAiError(e));
    } finally {
      setBusy(false);
    }
  }

  function updateDish(idx: number, patch: Partial<EditableDish>) {
    setDishes((prev) => prev && prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  async function logAll() {
    if (!dishes) return;
    setBusy(true);
    for (const d of dishes.filter((x) => x.include)) {
      const kept = keptIngredients(d.ingredients);
      const t = sumIngredients(kept);
      if (t.grams <= 0) continue;
      await addEntry({
        date: date || today(),
        meal,
        food_id: null,
        name: d.name,
        grams: t.grams,
        kcal: t.kcal,
        protein: t.protein,
        carbs: t.carbs,
        fat: t.fat,
        fiber: null,
        components: JSON.stringify(kept),
      });
    }
    bump();
    setBusy(false);
    router.dismissTo('/(tabs)/nutrition');
  }

  const totals = sumIngredients((dishes ?? []).filter((d) => d.include).flatMap((d) => keptIngredients(d.ingredients)));

  return (
    <Screen>
      {keyReady === false ? <ApiKeyPrompt onSaved={() => setKeyReady(true)} /> : null}
      <Card style={keyReady === false ? { opacity: 0.4 } : undefined} pointerEvents={keyReady === false ? 'none' : 'auto'}>
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginBottom: spacing.md }} resizeMode="cover" />
        ) : (
          <Text style={[font.small, { marginBottom: spacing.md }]}>
            צלמו את הארוחה. ה-AI מפרק כל מנה לרכיבים, כולל רכיבים נסתרים כמו שמן, חמאה ושמנת, כך שאפשר להסיר או
            לתקן כל מה שלא באמת שם.
          </Text>
        )}
        <Row style={{ gap: spacing.sm }}>
          <Button title="צילום" style={{ flex: 1 }} variant={uri ? 'secondary' : 'primary'} onPress={() => pick(true)} />
          <Button title="מהגלריה" style={{ flex: 1 }} variant="secondary" onPress={() => pick(false)} />
        </Row>
        {uri && !dishes ? (
          <>
            <Field
              label="רמז (לא חובה)"
              placeholder='למשל: "עם שמנת קלה, בלי חמאה"'
              value={hint}
              onChangeText={setHint}
              style={{ marginTop: spacing.md }}
            />
            <Button title="ניתוח" onPress={analyze} loading={busy} />
          </>
        ) : null}
        {error ? <Text style={[font.small, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}
      </Card>

      {dishes ? (
        <>
          <Card>
            <Segmented<Meal> options={MEAL_OPTS} value={meal} onChange={setMeal} />
            {dishes.length === 0 ? <Text style={font.small}>לא זוהה אוכל. נסו תמונה אחרת או הוסיפו רמז.</Text> : null}
            {notes ? <Text style={font.tiny}>{notes}</Text> : null}
          </Card>

          {dishes.map((d, idx) => {
            const t = sumIngredients(keptIngredients(d.ingredients));
            return (
              <Card key={idx} style={{ opacity: d.include ? 1 : 0.45 }}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm }}>
                  <View style={{ flex: 1, paddingEnd: spacing.sm }}>
                    <Text style={font.h3}>{d.name}</Text>
                    <Text style={font.tiny}>
                      {Math.round(t.grams)} ג׳ · ודאות {d.confidence === 'high' ? 'גבוהה' : d.confidence === 'medium' ? 'בינונית' : 'נמוכה'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[font.h3, { color: colors.calories }]}>{Math.round(t.kcal)} קק״ל</Text>
                    <Pressable hitSlop={8} onPress={() => updateDish(idx, { include: !d.include })}>
                      <Text style={[font.small, { color: colors.info, fontWeight: '600', marginTop: 2 }]}>
                        {d.include ? 'דילוג על המנה' : 'להוסיף'}
                      </Text>
                    </Pressable>
                  </View>
                </Row>
                {d.include ? (
                  <IngredientList items={d.ingredients} onChange={(ingredients) => updateDish(idx, { ingredients })} />
                ) : null}
              </Card>
            );
          })}

          <Card>
            <Row style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <Stat label="קלוריות" value={`${Math.round(totals.kcal)}`} color={colors.calories} />
              <Stat label="חלבון" value={`${Math.round(totals.protein)}`} sub="ג׳" color={colors.protein} />
              <Stat label="פחמימה" value={`${Math.round(totals.carbs)}`} sub="ג׳" color={colors.carbs} />
              <Stat label="שומן" value={`${Math.round(totals.fat)}`} sub="ג׳" color={colors.fat} />
            </Row>
            <Button title={`רישום ל${MEAL_SHORT[meal]}`} onPress={logAll} loading={busy} disabled={totals.grams <= 0} />
            <Button title="ניתוח מחדש" variant="ghost" onPress={analyze} style={{ marginTop: spacing.sm }} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
