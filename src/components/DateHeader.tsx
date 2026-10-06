import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../state/store';
import { addDays, formatDateLabel, parseISODate, today } from '../lib/dates';
import { colors, font, spacing } from '../theme';

export function DateHeader({ title }: { title: string }) {
  const { selectedDate, setSelectedDate } = useApp();
  const isToday = selectedDate === today();
  const long = parseISODate(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <View style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable onPress={() => setSelectedDate(today())}>
        <Text style={font.h1}>{isToday ? title : formatDateLabel(selectedDate)}</Text>
        <Text style={font.small}>{long}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Pressable onPress={() => setSelectedDate(addDays(selectedDate, -1))} hitSlop={8} style={navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setSelectedDate(addDays(selectedDate, 1))} hitSlop={8} style={navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const navBtn = {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.card,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
