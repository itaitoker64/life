import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Field, Row, Screen } from '../../src/components/ui';
import { getFoodByBarcode, insertFood, searchFoods } from '../../src/db/foods';
import type { Food, FoodInput } from '../../src/db/types';
import { searchProducts } from '../../src/lib/openfoodfacts';
import { colors, font, spacing } from '../../src/theme';

export default function Search() {
  const { date, meal } = useLocalSearchParams<{ date: string; meal: string }>();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [local, setLocal] = useState<Food[]>([]);
  const [online, setOnline] = useState<FoodInput[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = setTimeout(() => searchFoods(q).then(setLocal), 150);
    setOnline(null);
    return () => clearTimeout(h);
  }, [q]);

  async function searchOnline() {
    setLoading(true);
    setError('');
    try {
      setOnline(await searchProducts(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function openFood(id: number) {
    router.push({ pathname: '/food/[id]', params: { id: String(id), date, meal } });
  }

  async function pickOnline(f: FoodInput) {
    const existing = f.barcode ? await getFoodByBarcode(f.barcode) : null;
    const food = existing ?? (await insertFood(f));
    openFood(food.id);
  }

  const params = { date, meal };
  return (
    <Screen scroll={false}>
      <Field
        placeholder="Search foods"
        value={q}
        onChangeText={setQ}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => q.trim() && searchOnline()}
      />
      <Row style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <Button
          title="Scan"
          variant="secondary"
          style={{ flex: 1 }}
          icon={<Ionicons name="barcode-outline" size={16} color={colors.primary} />}
          onPress={() => router.replace({ pathname: '/food/scan', params })}
        />
        <Button
          title="Photo"
          variant="secondary"
          style={{ flex: 1 }}
          icon={<Ionicons name="camera-outline" size={16} color={colors.primary} />}
          onPress={() => router.replace({ pathname: '/food/photo', params })}
        />
        <Button
          title="Create"
          variant="secondary"
          style={{ flex: 1 }}
          icon={<Ionicons name="create-outline" size={16} color={colors.primary} />}
          onPress={() => router.push({ pathname: '/food/new', params: { ...params, name: q } })}
        />
      </Row>

      <View style={{ flex: 1 }}>
        <Card style={{ padding: 0, flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {local.map((f) => (
              <FoodRow
                key={f.id}
                name={f.name}
                brand={f.brand ?? f.name_en}
                kcal={f.kcal}
                serving={f.serving_g ? `${f.serving_name ?? 'serving'} ${f.serving_g} g` : null}
                onPress={() => openFood(f.id)}
              />
            ))}
            {q.trim() ? (
              <View style={{ padding: spacing.md }}>
                {online == null ? (
                  <Button title="Search Open Food Facts" variant="ghost" onPress={searchOnline} loading={loading} />
                ) : online.length === 0 ? (
                  <Text style={font.small}>No online results.</Text>
                ) : null}
                {error ? <Text style={[font.small, { color: colors.danger }]}>{error}</Text> : null}
              </View>
            ) : null}
            {online?.map((f, i) => (
              <FoodRow
                key={`${f.barcode ?? i}`}
                name={f.name}
                brand={f.brand}
                kcal={f.kcal}
                serving={f.serving_name}
                online
                onPress={() => pickOnline(f)}
              />
            ))}
            {local.length === 0 && q.trim() ? (
              <Text style={[font.small, { padding: spacing.md, paddingTop: 0 }]}>No local matches. Try Hebrew or English.</Text>
            ) : null}
          </ScrollView>
        </Card>
      </View>
    </Screen>
  );
}

function FoodRow({
  name,
  brand,
  kcal,
  serving,
  online,
  onPress,
}: {
  name: string;
  brand: string | null;
  kcal: number;
  serving: string | null;
  online?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.bg : 'transparent',
      })}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={font.body} numberOfLines={1}>
            {name}
          </Text>
          <Text style={font.tiny} numberOfLines={1}>
            {[brand, serving, online ? 'Open Food Facts' : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text style={font.small}>{Math.round(kcal)} kcal/100g</Text>
      </Row>
    </Pressable>
  );
}
