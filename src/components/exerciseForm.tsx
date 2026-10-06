// Create / edit a custom exercise (Lift's exerciseForm sheet).
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { EQUIPMENT, MUSCLES, equipmentHe, muscleHe } from '../strength/seed';
import { addExercise, updateExercise } from '../strength/store';
import type { Exercise, Tracking } from '../strength/types';
import { font, spacing } from '../theme';
import { Sheet, toast } from './sheet';
import { Button, Chip, Field, Segmented } from './ui';

export function ExerciseForm({
  visible,
  existing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  existing?: Exercise | null;
  onClose: () => void;
  onSaved?: (ex: Exercise) => void;
}) {
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState('Chest');
  const [equipment, setEquipment] = useState('Barbell');
  const [tracking, setTracking] = useState<Tracking>('weight');
  useEffect(() => {
    if (!visible) return;
    setName(existing ? existing.nameHe || existing.name : '');
    setPrimary(existing?.primary ?? 'Chest');
    setEquipment(existing?.equipment ?? 'Barbell');
    setTracking(existing?.tracking ?? 'weight');
  }, [visible, existing]);

  function save() {
    const n = name.trim();
    if (!n) {
      toast('תנו לתרגיל שם');
      return;
    }
    let ex: Exercise;
    if (existing) {
      const patch: Partial<Exercise> = { primary, equipment, tracking };
      if (existing.isCustom) patch.name = n;
      else patch.nameHe = n;
      updateExercise(existing.id, patch);
      ex = { ...existing, ...patch };
    } else {
      ex = addExercise({ name: n, primary, equipment, tracking });
    }
    onClose();
    onSaved?.(ex);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={existing ? 'עריכת תרגיל' : 'תרגיל חדש'} footer={<Button title={existing ? 'שמירה' : 'יצירת התרגיל'} onPress={save} />}>
      <Field label="שם" value={name} onChangeText={setName} placeholder="שם התרגיל" autoFocus={!existing} />
      <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>שריר עיקרי</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
        {MUSCLES.map((m) => (
          <Chip key={m} label={muscleHe(m)} active={primary === m} onPress={() => setPrimary(m)} />
        ))}
      </View>
      <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>ציוד</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
        {EQUIPMENT.map((q) => (
          <Chip key={q} label={equipmentHe(q)} active={equipment === q} onPress={() => setEquipment(q)} />
        ))}
      </View>
      <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>מעקב</Text>
      <Segmented<Tracking>
        options={[
          { value: 'weight', label: 'משקל וחזרות' },
          { value: 'cardio', label: 'זמן ומרחק (אירובי)' },
        ]}
        value={tracking}
        onChange={setTracking}
      />
    </Sheet>
  );
}
