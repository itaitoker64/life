// Exercise library, ported from lift/js/views/exercises.js.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseForm } from '../../src/components/exerciseForm';
import { ExerciseThumb } from '../../src/components/strength';
import { Chip, Field } from '../../src/components/ui';
import { MUSCLES, equipmentHe, muscleHe } from '../../src/strength/seed';
import { exerciseBests, exerciseName, exerciseSearchText, exercises, fmtW, unitLabel, useLiftVersion } from '../../src/strength/store';
import { fmtNum } from '../../src/strength/utils';
import { chevronForward, colors, font, spacing } from '../../src/theme';

export default function Exercises() {
  useLiftVersion();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [form, setForm] = useState(false);
  const query = q.trim().toLowerCase();
  const items = exercises().filter((e) => (muscle === 'All' || e.primary === muscle) && (!query || exerciseSearchText(e).includes(query)));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['left', 'right']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => setForm(true)} hitSlop={10}>
              <Ionicons name="add" size={26} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Field placeholder="חיפוש תרגיל" value={q} onChangeText={setQ} autoCorrect={false} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
              {['All', ...MUSCLES].map((m) => (
                <Chip key={m} label={m === 'All' ? 'הכול' : muscleHe(m)} active={muscle === m} onPress={() => setMuscle(m)} />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={[font.small, { textAlign: 'center', padding: spacing.lg }]}>אין כאן כלום. לחצו + להוספת תרגיל משלכם.</Text>}
        renderItem={({ item: e }) => {
          const best = exerciseBests(e.id);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/strength/exercise/[id]', params: { id: e.id } })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ExerciseThumb ex={e} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={font.body} numberOfLines={1}>
                  {exerciseName(e.id)}
                </Text>
                <Text style={font.tiny} numberOfLines={1}>
                  {muscleHe(e.primary)} · {equipmentHe(e.equipment)}
                  {best.e1rm ? ` · שיא ${fmtNum(fmtW(best.e1rm))} ${unitLabel()}` : ''}
                </Text>
              </View>
              <Ionicons name={chevronForward} size={18} color={colors.faint} />
            </Pressable>
          );
        }}
      />
      <ExerciseForm visible={form} onClose={() => setForm(false)} onSaved={(ex) => router.push({ pathname: '/strength/exercise/[id]', params: { id: ex.id } })} />
    </SafeAreaView>
  );
}
