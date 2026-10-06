// Routine editor, ported from lift/js/views/routine-edit.js.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, toast } from '../../../src/components/sheet';
import { DurationSheet, ExercisePicker, ExerciseThumb, NumCell, RepRangeSheet, SetBadge } from '../../../src/components/strength';
import { Button, IconButton, Row } from '../../../src/components/ui';
import { L, defaultRepRange, deleteRoutine, exercise, exerciseName, routine, saveRoutine, unitLabel } from '../../../src/strength/store';
import type { Routine, RoutineItem } from '../../../src/strength/types';
import { deepClone, fmtClock, uid } from '../../../src/strength/utils';
import { SET_TYPES, ss } from '../../../src/strength/workout';
import { chevronBack, colors, font, radius, spacing } from '../../../src/theme';

const blankSet = () => ({ type: 'normal' as const, weight: '' as const, reps: '' as const });

export default function RoutineEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new' || !routine(id);
  const [r] = useState<Routine>(() => {
    const src = !isNew ? deepClone(routine(id)!) : { id: uid(), name: '', notes: '', items: [], order: L.routines.length, createdAt: Date.now(), updatedAt: Date.now() };
    for (const it of src.items) {
      if (!it.repMin) {
        const rr = defaultRepRange(it.exerciseId);
        it.repMin = rr.min;
        it.repMax = rr.max;
      }
    }
    return src;
  });
  const baseline = useMemo(() => JSON.stringify(r), []);
  const [, setV] = useState(0);
  const rerender = () => setV((n) => n + 1);
  const [picker, setPicker] = useState<null | { replace?: RoutineItem }>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [ssFor, setSsFor] = useState<RoutineItem | null>(null);
  const [restFor, setRestFor] = useState<RoutineItem | null>(null);
  const [rangeFor, setRangeFor] = useState<RoutineItem | null>(null);
  const dirty = useRef(false);

  function save() {
    if (!r.items.length) {
      toast('הוסיפו לפחות תרגיל אחד');
      return;
    }
    r.name = r.name.trim() || 'רוטינה חדשה';
    saveRoutine(r);
    toast('הרוטינה נשמרה');
    router.back();
  }

  function leave() {
    if (!dirty.current && JSON.stringify(r) === baseline) return router.back();
    Alert.alert('לבטל את השינויים?', 'יש שינויים שלא נשמרו ברוטינה.', [
      { text: 'להמשיך לערוך', style: 'cancel' },
      { text: 'לבטל', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  function change() {
    dirty.current = true;
    rerender();
  }

  const menuItem = menuFor != null ? r.items[menuFor] : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <Row style={{ paddingHorizontal: spacing.sm, paddingVertical: 6, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <IconButton name={chevronBack} onPress={leave} />
        <Text style={[font.h3, { flex: 1 }]}>{isNew ? 'רוטינה חדשה' : 'עריכת רוטינה'}</Text>
        <Button title="שמירה" size="sm" onPress={save} />
      </Row>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <TextInput
          defaultValue={r.name}
          onChangeText={(t) => ((r.name = t), (dirty.current = true))}
          placeholder="שם הרוטינה"
          placeholderTextColor={colors.faint}
          style={inputStyle({ fontSize: 17, fontWeight: '700' })}
        />
        <TextInput
          defaultValue={r.notes}
          onChangeText={(t) => ((r.notes = t), (dirty.current = true))}
          placeholder="הערות (לא חובה)"
          placeholderTextColor={colors.faint}
          multiline
          style={inputStyle({ minHeight: 60, textAlignVertical: 'top' })}
        />

        {!r.items.length ? <Text style={[font.small, { textAlign: 'center', padding: spacing.lg }]}>אין עדיין תרגילים. הוסיפו למטה.</Text> : null}

        {r.items.map((it, idx) => {
          const ex = exercise(it.exerciseId);
          const ssColor = it.superset ? ss.color(r.items, it) : null;
          return (
            <View
              key={`${it.exerciseId}-${idx}`}
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                borderStartWidth: ssColor ? 4 : 1,
                borderStartColor: ssColor ?? colors.border,
                padding: 12,
                marginBottom: spacing.md,
              }}
            >
              <Row style={{ gap: spacing.sm }}>
                <ExerciseThumb ex={ex} size={34} />
                <View style={{ flex: 1 }}>
                  {it.superset ? <Text style={{ color: ssColor!, fontSize: 11, fontWeight: '800' }}>{ss.label(r.items, it)}</Text> : null}
                  <Text style={font.h3}>{ex ? exerciseName(ex.id) : 'תרגיל שנמחק'}</Text>
                </View>
                <Pressable onPress={() => setMenuFor(idx)} hitSlop={8} style={{ padding: 4 }}>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
                </Pressable>
              </Row>
              <TextInput
                defaultValue={it.notes}
                onChangeText={(t) => ((it.notes = t), (dirty.current = true))}
                placeholder="הערה…"
                placeholderTextColor={colors.faint}
                style={inputStyle({ marginTop: 8, marginBottom: 6, paddingVertical: 6 })}
              />
              <Row style={{ justifyContent: 'space-between', marginVertical: 3 }}>
                <Text style={font.small}>טווח חזרות</Text>
                <Pill text={`${it.repMin}–${it.repMax}`} onPress={() => setRangeFor(it)} />
              </Row>
              <Row style={{ justifyContent: 'space-between', marginVertical: 3 }}>
                <Text style={font.small}>טיימר מנוחה</Text>
                <Pill text={it.restSec ? fmtClock(it.restSec) : 'כבוי'} onPress={() => setRestFor(it)} />
              </Row>
              <Row style={{ marginTop: 8 }}>
                <Text style={[font.tiny, { width: 40, textAlign: 'center' }]}>סט</Text>
                <Text style={[font.tiny, { flex: 1, textAlign: 'center' }]}>{unitLabel()}</Text>
                <Text style={[font.tiny, { flex: 1, textAlign: 'center' }]}>חזרות</Text>
                <View style={{ width: 36 }} />
              </Row>
              {it.sets.map((st, si) => (
                <Row key={si} style={{ paddingVertical: 3 }}>
                  <View style={{ width: 40, alignItems: 'center' }}>
                    <SetBadge
                      sets={it.sets}
                      index={si}
                      onPress={() => {
                        st.type = SET_TYPES[(SET_TYPES.indexOf(st.type) + 1) % SET_TYPES.length];
                        change();
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <NumCell value={st.weight} isWeight placeholder={unitLabel()} onCommit={(v) => ((st.weight = v), change())} width={80} />
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <NumCell value={st.reps} isWeight={false} placeholder="—" onCommit={(v) => ((st.reps = v), change())} width={70} />
                  </View>
                  <Pressable
                    onPress={() => {
                      it.sets.splice(si, 1);
                      if (!it.sets.length) it.sets.push(blankSet());
                      change();
                    }}
                    hitSlop={6}
                    style={{ width: 36, alignItems: 'center' }}
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.faint} />
                  </Pressable>
                </Row>
              ))}
              <Pressable
                onPress={() => {
                  const p = it.sets[it.sets.length - 1];
                  it.sets.push(p ? { type: 'normal', weight: p.weight, reps: p.reps } : blankSet());
                  change();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, marginTop: 6, borderRadius: radius.sm, backgroundColor: colors.elev2 }}
              >
                <Ionicons name="add" size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>הוספת סט</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable
          onPress={() => setPicker({})}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.primarySoft }}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700' }}>הוספת תרגיל</Text>
        </Pressable>

        {!isNew ? (
          <Button
            title="מחיקת הרוטינה"
            variant="ghost"
            style={{ marginTop: spacing.lg }}
            onPress={() =>
              Alert.alert('למחוק את הרוטינה?', undefined, [
                { text: 'ביטול', style: 'cancel' },
                {
                  text: 'מחיקה',
                  style: 'destructive',
                  onPress: () => {
                    deleteRoutine(r.id);
                    router.back();
                  },
                },
              ])
            }
          />
        ) : null}
      </ScrollView>

      <ExercisePicker
        visible={!!picker}
        single={!!picker?.replace}
        onClose={() => setPicker(null)}
        onDone={(ids) => {
          if (picker?.replace) {
            picker.replace.exerciseId = ids[0];
          } else {
            for (const exId of ids) {
              const rr = defaultRepRange(exId);
              r.items.push({
                exerciseId: exId,
                restSec: r.items.length ? r.items[0].restSec : L.settings.defaultRestSec,
                repMin: rr.min,
                repMax: rr.max,
                notes: '',
                sets: [blankSet()],
              });
            }
          }
          change();
        }}
      />
      <Menu
        visible={menuItem != null}
        onClose={() => setMenuFor(null)}
        title={menuItem ? exerciseName(menuItem.exerciseId) : undefined}
        items={
          menuItem && menuFor != null
            ? [
                menuFor > 0 ? { label: 'להזיז למעלה', icon: 'arrow-up', onPress: () => swap(menuFor, menuFor - 1) } : null,
                menuFor < r.items.length - 1 ? { label: 'להזיז למטה', icon: 'arrow-down', onPress: () => swap(menuFor, menuFor + 1) } : null,
                menuItem.superset
                  ? { label: 'הוצאה מהסופרסט', icon: 'link-outline', onPress: () => (ss.unlink(r.items, menuItem), change()) }
                  : r.items.length > 1
                    ? { label: 'סופרסט עם…', icon: 'link-outline', onPress: () => setSsFor(menuItem) }
                    : null,
                { label: 'החלפת תרגיל', icon: 'swap-horizontal', onPress: () => setPicker({ replace: menuItem }) },
                { label: 'הסרה מהרוטינה', icon: 'trash-outline', danger: true, onPress: () => (r.items.splice(menuFor, 1), ss.tidy(r.items), change()) },
              ]
            : []
        }
      />
      <Menu
        visible={!!ssFor}
        onClose={() => setSsFor(null)}
        title={ssFor ? `סופרסט ${exerciseName(ssFor.exerciseId)} עם` : undefined}
        items={
          ssFor
            ? r.items
                .filter((x) => x !== ssFor)
                .map((x) => ({
                  label: exerciseName(x.exerciseId) + (x.superset ? ` (${ss.label(r.items, x)})` : ''),
                  onPress: () => (ss.link(r.items, ssFor, x), change()),
                }))
            : []
        }
      />
      <DurationSheet
        visible={!!restFor}
        title={restFor ? `מנוחה · ${exerciseName(restFor.exerciseId)}` : ''}
        value={restFor?.restSec ?? 0}
        onClose={() => setRestFor(null)}
        onDone={(sec) => {
          if (restFor) restFor.restSec = sec;
          change();
        }}
      />
      <RepRangeSheet
        visible={!!rangeFor}
        title={rangeFor ? `טווח חזרות · ${exerciseName(rangeFor.exerciseId)}` : ''}
        min={rangeFor?.repMin ?? 8}
        max={rangeFor?.repMax ?? 12}
        onClose={() => setRangeFor(null)}
        onDone={(lo, hi) => {
          if (rangeFor) {
            rangeFor.repMin = lo;
            rangeFor.repMax = hi;
          }
          change();
        }}
      />
    </SafeAreaView>
  );

  function swap(x: number, y: number) {
    const t = r.items[x];
    r.items[x] = r.items[y];
    r.items[y] = t;
    ss.tidy(r.items);
    change();
  }
}

function Pill({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.elev2, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
}

function inputStyle(extra: object) {
  return {
    color: colors.text,
    backgroundColor: colors.elev2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    ...extra,
  };
}
