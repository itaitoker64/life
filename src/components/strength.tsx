// Small strength-specific widgets shared by the workout, routine, history and exercise screens.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { EXERCISE_IMAGES } from '../strength/images';
import { MUSCLES, muscleHe, equipmentHe } from '../strength/seed';
import { exerciseName, exerciseSearchText, exercises, fmtW, fromDisplay } from '../strength/store';
import type { Exercise, Num, SetType } from '../strength/types';
import { fmtClock, fmtNum, initials } from '../strength/utils';
import { SET_GLYPH, workingNum } from '../strength/workout';
import { colors, font, radius, spacing } from '../theme';
import { Button, Chip, Field } from './ui';
import { Sheet } from './sheet';

export function ExerciseThumb({ ex, size = 40 }: { ex: Exercise | null; size?: number }) {
  const r = Math.max(8, Math.round(size * 0.27));
  const img = ex?.image ? EXERCISE_IMAGES[ex.image] : null;
  if (img) return <Image source={img} style={{ width: size, height: size, borderRadius: r, backgroundColor: '#fff' }} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: Math.round(size * 0.36) }}>
        {initials(ex ? exerciseName(ex.id) : '?')}
      </Text>
    </View>
  );
}

const BADGE: Record<SetType, { bg: string; fg: string }> = {
  normal: { bg: colors.elev2, fg: colors.text },
  warmup: { bg: 'rgba(245,158,11,0.16)', fg: colors.warning },
  drop: { bg: 'rgba(139,92,246,0.18)', fg: '#a78bfa' },
  fail: { bg: colors.dangerSoft, fg: colors.danger },
};

export function SetBadge({ sets, index, onPress }: { sets: Array<{ type: SetType }>; index: number; onPress?: () => void }) {
  const st = sets[index];
  const c = BADGE[st.type] ?? BADGE.normal;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={4}
      style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: c.fg, fontWeight: '800', fontSize: 13 }}>{SET_GLYPH[st.type] ?? String(workingNum(sets, index))}</Text>
    </Pressable>
  );
}

/** Numeric cell: shows display units, stores kg. Commits on blur like Lift's set inputs. */
export function NumCell({
  value,
  isWeight,
  placeholder,
  onCommit,
  done,
  width = 64,
}: {
  value: Num;
  isWeight: boolean;
  placeholder?: string;
  onCommit: (v: Num) => void;
  done?: boolean;
  width?: number;
}) {
  const shown = value === '' || value == null ? '' : isWeight ? fmtNum(fmtW(value)) : String(value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={() => {
        const raw = text.trim().replace(',', '.');
        if (raw === '') return onCommit('');
        const n = parseFloat(raw);
        if (Number.isNaN(n) || n < 0) return setText(shown);
        onCommit(isWeight ? fromDisplay(n) : Math.round(n));
      }}
      keyboardType="decimal-pad"
      selectTextOnFocus
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      style={{
        width,
        height: 36,
        borderRadius: 9,
        backgroundColor: done ? 'transparent' : colors.elev2,
        color: colors.text,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        paddingVertical: 0,
      }}
    />
  );
}

/** Multi-select exercise picker with search and muscle chips (Lift's App.exercisePicker). */
export function ExercisePicker({
  visible,
  onClose,
  onDone,
  single,
  excludeIds = [],
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (ids: string[]) => void;
  single?: boolean;
  excludeIds?: string[];
  onCreate?: () => void;
}) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('All');
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (visible) {
      setPicked([]);
      setQ('');
    }
  }, [visible]);
  const query = q.trim().toLowerCase();
  const list = exercises().filter(
    (e) => !excludeIds.includes(e.id) && (muscle === 'All' || e.primary === muscle) && (!query || exerciseSearchText(e).includes(query)),
  );
  const toggle = (id: string) => {
    if (single) {
      onClose();
      onDone([id]);
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={single ? 'בחירת תרגיל' : 'הוספת תרגילים'}
      scroll={false}
      footer={
        single ? null : (
          <Button
            title={picked.length ? `הוספת ${picked.length} תרגילים` : 'הוספה'}
            disabled={!picked.length}
            onPress={() => {
              onClose();
              onDone(picked);
            }}
          />
        )
      }
    >
      <Field placeholder="חיפוש תרגיל" value={q} onChangeText={setQ} autoCorrect={false} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
        {['All', ...MUSCLES].map((m) => (
          <Chip key={m} label={m === 'All' ? 'הכול' : muscleHe(m)} active={muscle === m} onPress={() => setMuscle(m)} />
        ))}
      </View>
      {onCreate ? (
        <Pressable
          onPress={onCreate}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 42,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            marginBottom: spacing.sm,
          }}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>תרגיל חדש</Text>
        </Pressable>
      ) : null}
      <View style={{ flexShrink: 1, maxHeight: 420 }}>
        <ListOf items={list} picked={picked} onToggle={toggle} single={single} />
      </View>
    </Sheet>
  );
}

function ListOf({ items, picked, onToggle, single }: { items: Exercise[]; picked: string[]; onToggle: (id: string) => void; single?: boolean }) {
  if (!items.length) return <Text style={[font.small, { textAlign: 'center', padding: spacing.lg }]}>אין תרגילים תואמים</Text>;
  return (
    <FlatList
      data={items}
      keyExtractor={(e) => e.id}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={20}
      renderItem={({ item: e }) => {
        const on = picked.includes(e.id);
        return (
          <Pressable
            onPress={() => onToggle(e.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            {single ? null : (
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
              </View>
            )}
            <ExerciseThumb ex={e} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={font.body} numberOfLines={1}>
                {exerciseName(e.id)}
              </Text>
              <Text style={font.tiny} numberOfLines={1}>
                {muscleHe(e.primary)} · {equipmentHe(e.equipment)}
                {e.isCustom ? ' · מותאם' : ''}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

/** Rep range picker: two rows of chips (Lift's UI.repRangePicker). */
export function RepRangeSheet({
  visible,
  title,
  min,
  max,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  min: number;
  max: number;
  onClose: () => void;
  onDone: (lo: number, hi: number) => void;
}) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  useEffect(() => {
    if (visible) {
      setLo(min);
      setHi(max);
    }
  }, [visible, min, max]);
  const presets: Array<[number, number]> = [[5, 8], [6, 10], [8, 12], [10, 15], [12, 20], [15, 25]];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          title={`שמירה · ${lo}–${hi}`}
          onPress={() => {
            onClose();
            onDone(Math.min(lo, hi), Math.max(lo, hi));
          }}
        />
      }
    >
      <Text style={[font.small, { marginBottom: spacing.sm }]}>טווחים נפוצים</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg }}>
        {presets.map(([a, b]) => (
          <Chip key={`${a}-${b}`} label={`${a}–${b}`} active={lo === a && hi === b} onPress={() => (setLo(a), setHi(b))} />
        ))}
      </View>
      <Stepper label="מינימום" value={lo} onChange={(v) => setLo(Math.max(1, Math.min(v, 50)))} />
      <Stepper label="מקסימום" value={hi} onChange={(v) => setHi(Math.max(1, Math.min(v, 60)))} />
      <Text style={[font.tiny, { marginTop: spacing.sm }]}>
        כל טווח בין ~6 ל-30 חזרות בונה שריר כשהסט קרוב לכשל. כשמגיעים לחלק העליון בכל הסטים — המשקל עולה.
      </Text>
    </Sheet>
  );
}

export function Stepper({ label, value, onChange, step = 1, format }: { label: string; value: number; onChange: (v: number) => void; step?: number; format?: (v: number) => string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={font.body}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <RoundBtn icon="remove" onPress={() => onChange(value - step)} />
        <Text style={[font.h2, { minWidth: 64, textAlign: 'center' }]}>{format ? format(value) : value}</Text>
        <RoundBtn icon="add" onPress={() => onChange(value + step)} />
      </View>
    </View>
  );
}

function RoundBtn({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: pressed ? colors.border : colors.elev2,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/** Rest-timer duration picker (Lift's UI.durationPicker). */
export function DurationSheet({
  visible,
  title,
  value,
  onClose,
  onDone,
}: {
  visible: boolean;
  title: string;
  value: number;
  onClose: () => void;
  onDone: (sec: number) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (visible) setV(value);
  }, [visible, value]);
  const presets = [0, 60, 90, 120, 150, 180, 240, 300];
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          title="שמירה"
          onPress={() => {
            onClose();
            onDone(v);
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.lg }}>
        {presets.map((p) => (
          <Chip key={p} label={p ? fmtClock(p) : 'כבוי'} active={v === p} onPress={() => setV(p)} />
        ))}
      </View>
      <Stepper label="מנוחה" value={v} step={15} onChange={(n) => setV(Math.max(0, Math.min(n, 900)))} format={(n) => (n ? fmtClock(n) : 'כבוי')} />
      <Text style={[font.tiny, { marginTop: spacing.sm }]}>
        מחקרים מראים שמנוחה מתחת ל-60 שנ׳ פוגעת בחזרות בסטים הבאים; מעל ~90 שנ׳ כבר אין הבדל לצמיחה.
      </Text>
    </Sheet>
  );
}
