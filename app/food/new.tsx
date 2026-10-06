import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button, Card, Field, Row, Screen, parseNum } from '../../src/components/ui';
import { getFood, getFoodByBarcode, insertFood, updateFood } from '../../src/db/foods';
import type { FoodInput } from '../../src/db/types';
import { describeAiError, hasApiKey, readNutritionLabel, type LabelData } from '../../src/lib/ai';
import { useApp } from '../../src/state/store';
import { colors, font, spacing } from '../../src/theme';

type Form = Record<'name' | 'brand' | 'barcode' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium' | 'servingG' | 'servingName', string>;

const EMPTY: Form = {
  name: '',
  brand: '',
  barcode: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  sugar: '',
  sodium: '',
  servingG: '',
  servingName: '',
};

function fromLabel(l: LabelData): Partial<Form> {
  const n = l.per_100g;
  const s = (v: number | null) => (v == null ? '' : String(Math.round(v * 10) / 10));
  return {
    name: l.product_name ?? '',
    brand: l.brand ?? '',
    kcal: s(n.kcal),
    protein: s(n.protein_g),
    carbs: s(n.carbs_g),
    fat: s(n.fat_g),
    fiber: s(n.fiber_g),
    sugar: s(n.sugar_g),
    sodium: l.per_100g.sodium_mg == null ? '' : String(Math.round(l.per_100g.sodium_mg)),
    servingG: s(l.serving_size_g),
    servingName: l.serving_name ?? '',
  };
}

export default function NewFood() {
  const params = useLocalSearchParams<{
    id?: string;
    barcode?: string;
    name?: string;
    prefill?: string;
    date?: string;
    meal?: string;
  }>();
  const router = useRouter();
  const { bump } = useApp();
  const [form, setForm] = useState<Form>({ ...EMPTY, barcode: params.barcode ?? '', name: params.name ?? '' });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const editing = params.id != null;

  useEffect(() => {
    if (params.prefill) {
      try {
        setForm((f) => ({ ...f, ...fromLabel(JSON.parse(params.prefill!) as LabelData) }));
        setPrefilled(true);
      } catch {}
    }
  }, [params.prefill]);

  useEffect(() => {
    if (!params.id) return;
    getFood(Number(params.id)).then((f) => {
      if (!f) return;
      const s = (v: number | null) => (v == null ? '' : String(v));
      setForm({
        name: f.name,
        brand: f.brand ?? '',
        barcode: f.barcode ?? '',
        kcal: s(f.kcal),
        protein: s(f.protein),
        carbs: s(f.carbs),
        fat: s(f.fat),
        fiber: s(f.fiber),
        sugar: s(f.sugar),
        sodium: s(f.sodium_mg),
        servingG: s(f.serving_g),
        servingName: f.serving_name ?? '',
      });
    });
  }, [params.id]);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function scanLabel() {
    if (!(await hasApiKey())) {
      Alert.alert('צריך מפתח Gemini', 'קריאת תווית עם AI צריכה מפתח Gemini (חינמי).', [
        { text: 'ביטול', style: 'cancel' },
        { text: 'להגדרות', onPress: () => router.push('/settings') },
      ]);
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled) return;
    setAiBusy(true);
    try {
      const label = await readNutritionLabel(res.assets[0], form.barcode.trim() || undefined);
      if (!label.readable) {
        Alert.alert('לא הצלחתי לקרוא את התווית', 'נסו שוב עם תאורה טובה יותר וכל הטבלה בתוך התמונה.');
        return;
      }
      setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(fromLabel(label)).filter(([, v]) => v !== '')) }));
      setPrefilled(true);
    } catch (e) {
      Alert.alert('שגיאת AI', describeAiError(e));
    } finally {
      setAiBusy(false);
    }
  }

  async function save() {
    const kcal = parseNum(form.kcal);
    if (!form.name.trim() || kcal == null) {
      Alert.alert('חסרים פרטים', 'חובה למלא שם וקלוריות ל-100 ג׳.');
      return;
    }
    setBusy(true);
    const barcode = form.barcode.trim() || null;
    const input: FoodInput = {
      name: form.name.trim(),
      name_en: null,
      brand: form.brand.trim() || null,
      barcode,
      source: prefilled ? 'ai' : 'user',
      kcal,
      protein: parseNum(form.protein) ?? 0,
      carbs: parseNum(form.carbs) ?? 0,
      fat: parseNum(form.fat) ?? 0,
      fiber: parseNum(form.fiber),
      sugar: parseNum(form.sugar),
      sodium_mg: parseNum(form.sodium),
      serving_g: parseNum(form.servingG),
      serving_name: form.servingName.trim() || null,
      image_url: null,
    };
    try {
      if (editing) {
        await updateFood(Number(params.id), input);
        bump();
        router.back();
        return;
      }
      if (barcode) {
        const dup = await getFoodByBarcode(barcode);
        if (dup) {
          Alert.alert('הברקוד כבר קיים', `"${dup.name}" כבר משתמש בברקוד הזה. לפתוח אותו?`, [
            { text: 'ביטול', style: 'cancel' },
            { text: 'לפתוח', onPress: () => router.replace({ pathname: '/food/[id]', params: { id: String(dup.id), date: params.date, meal: params.meal } }) },
          ]);
          return;
        }
      }
      const food = await insertFood(input);
      bump();
      router.replace({ pathname: '/food/[id]', params: { id: String(food.id), date: params.date, meal: params.meal } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Field label="שם" value={form.name} onChangeText={set('name')} autoFocus={!prefilled} placeholder="למשל: חטיף חלבון" />
        <Field label="מותג (לא חובה)" value={form.brand} onChangeText={set('brand')} />
        <Field label="ברקוד (לא חובה)" value={form.barcode} onChangeText={set('barcode')} keyboardType="number-pad" />
        <Button
          title="צילום טבלת ערכים תזונתיים"
          variant="secondary"
          onPress={scanLabel}
          loading={aiBusy}
        />
        {prefilled ? (
          <Text style={[font.tiny, { marginTop: spacing.sm }]}>
            הערכים נקראו מהתווית על ידי AI. בדקו אותם לפני השמירה.
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={[font.h3, { marginBottom: spacing.sm }]}>ל-100 ג׳</Text>
        <Row style={{ gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="קלוריות" value={form.kcal} onChangeText={set('kcal')} keyboardType="decimal-pad" suffix="קק״ל" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="חלבון" value={form.protein} onChangeText={set('protein')} keyboardType="decimal-pad" suffix="ג׳" />
          </View>
        </Row>
        <Row style={{ gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="פחמימות" value={form.carbs} onChangeText={set('carbs')} keyboardType="decimal-pad" suffix="ג׳" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="שומן" value={form.fat} onChangeText={set('fat')} keyboardType="decimal-pad" suffix="ג׳" />
          </View>
        </Row>
        <Row style={{ gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="סיבים" value={form.fiber} onChangeText={set('fiber')} keyboardType="decimal-pad" suffix="ג׳" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="סוכר" value={form.sugar} onChangeText={set('sugar')} keyboardType="decimal-pad" suffix="ג׳" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="נתרן" value={form.sodium} onChangeText={set('sodium')} keyboardType="decimal-pad" suffix="מ״ג" />
          </View>
        </Row>
      </Card>

      <Card>
        <Text style={[font.h3, { marginBottom: spacing.sm }]}>מנה (לא חובה)</Text>
        <Row style={{ gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="גודל מנה" value={form.servingG} onChangeText={set('servingG')} keyboardType="decimal-pad" suffix="ג׳" />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="שם המנה" value={form.servingName} onChangeText={set('servingName')} placeholder="חטיף אחד" />
          </View>
        </Row>
      </Card>

      <Button title={editing ? 'שמירת שינויים' : 'שמירת המזון'} onPress={save} loading={busy} />
      <Text style={[font.tiny, { textAlign: 'center', marginTop: spacing.md, color: colors.muted }]}>
        מזון עם ברקוד יימצא מיד בסריקה הבאה.
      </Text>
    </Screen>
  );
}
