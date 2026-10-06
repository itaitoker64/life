import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import { MacroBar } from '../components/charts';
import { DateHeader } from '../components/DateHeader';
import { Button, Card, Row, styles as ui } from '../components/ui';
import { entriesForDate, moveEntry } from '../db/log';
import { MEALS, mealForNow, parseComponents, type LogEntry, type Meal } from '../db/types';
import { useApp } from '../state/store';
import { colors, font, radius, shadow, spacing } from '../theme';

export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'ארוחת בוקר', lunch: 'ארוחת צהריים', dinner: 'ארוחת ערב', snack: 'נשנושים' };

interface Rect {
  y: number;
  h: number;
}

export function FoodLog() {
  const { selectedDate, version, bump, profile } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [dragging, setDragging] = useState<LogEntry | null>(null);
  const [hover, setHover] = useState<Meal | null>(null);

  const rootRef = useRef<View>(null);
  const zoneRefs = useRef<Partial<Record<Meal, View | null>>>({});
  const zones = useRef<Partial<Record<Meal, Rect>>>({});
  const rootY = useRef(0);
  const ghostY = useRef(new Animated.Value(0)).current;
  const hoverRef = useRef<Meal | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setLoadError(false);
      setEntries([]);
      entriesForDate(selectedDate).then(rows => { if (alive) setEntries(rows); })
        .catch(() => { if (alive) setLoadError(true); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, [selectedDate, version]),
  );

  // Drop zones are measured in window coordinates when a drag begins, so scrolling beforehand is fine.
  function measureZones() {
    rootRef.current?.measureInWindow((_x, y) => {
      rootY.current = y;
    });
    for (const m of MEALS) {
      zoneRefs.current[m]?.measureInWindow((_x, y, _w, h) => {
        zones.current[m] = { y, h };
      });
    }
  }

  function zoneAt(absY: number): Meal | null {
    for (const m of MEALS) {
      const r = zones.current[m];
      if (r && absY >= r.y && absY <= r.y + r.h) return m;
    }
    return null;
  }

  function onDragStart(entry: LogEntry, absY: number) {
    measureZones();
    ghostY.setValue(absY - rootY.current - 28);
    hoverRef.current = entry.meal;
    setHover(entry.meal);
    setDragging(entry);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }

  function onDragMove(absY: number) {
    ghostY.setValue(absY - rootY.current - 28);
    const z = zoneAt(absY);
    if (z !== hoverRef.current) {
      hoverRef.current = z;
      setHover(z);
      if (z) Haptics.selectionAsync().catch(() => {});
    }
  }

  async function onDragEnd(entry: LogEntry, absY: number) {
    const target = zoneAt(absY);
    setDragging(null);
    setHover(null);
    hoverRef.current = null;
    if (!target || target === entry.meal) return;
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, meal: target } : e)));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await moveEntry(entry.id, target);
    bump();
  }

  function onDragCancel() {
    setDragging(null);
    setHover(null);
    hoverRef.current = null;
  }

  const total = entries.reduce((s, e) => s + e.kcal, 0);

  return (
    <View style={ui.screen}>
      <View
        ref={rootRef}
        style={{ flex: 1 }}
        collapsable={false}
        onLayout={() => rootRef.current?.measureInWindow((_x, y) => (rootY.current = y))}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
          scrollEnabled={!dragging}
          showsVerticalScrollIndicator={false}
        >
          <DateHeader title="יומן אכילה" />
          <Card>
            {loading || loadError ? <Text style={font.small}>{loadError ? 'לא הצלחנו לטעון את היומן. חזרו למסך כדי לנסות שוב.' : 'טוענים את היומן…'}</Text> : <>
            <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
              <View><Text style={font.small}>קלוריות שנרשמו</Text><Text style={font.h1}>{Math.round(total)}<Text style={font.small}> / {profile?.target_kcal ?? '—'}</Text></Text></View>
              <View><Text style={font.small}>{total > (profile?.target_kcal ?? 0) ? 'מעל היעד' : 'נותרו ליעד'}</Text><Text style={font.h2}>{profile ? Math.abs(Math.round(profile.target_kcal - total)) : '—'}</Text></View>
            </Row>
            <MacroBar label="חלבון" value={entries.reduce((s, e) => s + e.protein, 0)} max={profile?.target_protein ?? 0} color={colors.protein} />
            <MacroBar label="פחמימות" value={entries.reduce((s, e) => s + e.carbs, 0)} max={profile?.target_carbs ?? 0} color={colors.carbs} />
            <MacroBar label="שומן" value={entries.reduce((s, e) => s + e.fat, 0)} max={profile?.target_fat ?? 0} color={colors.fat} />
            </>}
            <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Button title="הוספת אוכל" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/food/search', params: { date: selectedDate, meal: mealForNow() } })} />
              <Button title="צילום ארוחה" variant="secondary" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/food/photo', params: { date: selectedDate, meal: mealForNow() } })} />
            </Row>
          </Card>

          {MEALS.map((meal) => {
            const items = entries.filter((e) => e.meal === meal);
            const kcal = items.reduce((s, e) => s + e.kcal, 0);
            const params = { date: selectedDate, meal };
            const isTarget = dragging != null && hover === meal && meal !== dragging.meal;
            return (
              <View
                key={meal}
                ref={(r) => {
                  zoneRefs.current[meal] = r;
                }}
                collapsable={false}
                style={[
                  ui.card,
                  {
                    padding: 0,
                    borderWidth: isTarget ? 2 : 1,
                    borderColor: isTarget ? colors.info : colors.border,
                    backgroundColor: isTarget ? colors.primarySoft : colors.card,
                  },
                ]}
              >
                <Row style={{ justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.sm }}>
                  <View>
                    <Text style={font.h3}>{MEAL_LABEL[meal]}</Text>
                    <Text style={font.tiny}>{Math.round(kcal)} קק״ל</Text>
                  </View>
                  <Row style={{ gap: spacing.md }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`סריקת ברקוד ל${MEAL_LABEL[meal]}`} style={{ minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.push({ pathname: '/food/scan', params })}>
                      <Ionicons name="barcode-outline" size={22} color={colors.text} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`צילום ל${MEAL_LABEL[meal]}`} style={{ minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.push({ pathname: '/food/photo', params })}>
                      <Ionicons name="camera-outline" size={22} color={colors.text} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`הוספה ל${MEAL_LABEL[meal]}`} style={{ minWidth: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => router.push({ pathname: '/food/search', params })}>
                      <Ionicons name="add-circle" size={26} color={colors.primary} />
                    </Pressable>
                  </Row>
                </Row>
                {items.map((e) => (
                  <DraggableEntry
                    key={e.id}
                    entry={e}
                    hidden={dragging?.id === e.id}
                    onPress={() => router.push({ pathname: '/entry/[id]', params: { id: String(e.id) } })}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                    onDragCancel={onDragCancel}
                  />
                ))}
                {items.length === 0 ? (
                  <Text style={[font.tiny, { paddingHorizontal: spacing.md, paddingBottom: spacing.md }]}>
                    {isTarget ? 'שחררו כאן' : loading ? 'טוענים…' : loadError ? 'הנתונים לא זמינים כרגע' : 'עוד לא נרשם כלום'}
                  </Text>
                ) : null}
              </View>
            );
          })}
          <Text style={[font.tiny, { textAlign: 'center' }]}>הקשה לעריכה · לחיצה ארוכה וגרירה להעברה לארוחה אחרת</Text>
        </ScrollView>

        {dragging ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spacing.lg,
              right: spacing.lg,
              top: 0,
              transform: [{ translateY: ghostY }, { scale: 1.03 }],
              backgroundColor: colors.card,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadow,
              shadowOpacity: 0.18,
              elevation: 8,
            }}
          >
            <EntryContent entry={dragging} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function DraggableEntry({
  entry,
  hidden,
  onPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  entry: LogEntry;
  hidden: boolean;
  onPress: () => void;
  onDragStart: (e: LogEntry, absY: number) => void;
  onDragMove: (absY: number) => void;
  onDragEnd: (e: LogEntry, absY: number) => void;
  onDragCancel: () => void;
}) {
  const started = useRef(false);
  // The gesture must stay the same object for the whole drag; the parent re-renders on every hover
  // change, so the latest callbacks are read through a ref instead of being gesture dependencies.
  const cb = useRef({ entry, onDragStart, onDragMove, onDragEnd, onDragCancel });
  cb.current = { entry, onDragStart, onDragMove, onDragEnd, onDragCancel };
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(300)
        .runOnJS(true)
        .onStart((ev) => {
          started.current = true;
          cb.current.onDragStart(cb.current.entry, ev.absoluteY);
        })
        .onUpdate((ev) => cb.current.onDragMove(ev.absoluteY))
        .onEnd((ev, success) => {
          started.current = false;
          if (success) cb.current.onDragEnd(cb.current.entry, ev.absoluteY);
          else cb.current.onDragCancel();
        })
        .onFinalize(() => {
          if (started.current) {
            started.current = false;
            cb.current.onDragCancel();
          }
        }),
    [],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={{ opacity: hidden ? 0.25 : 1 }}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: pressed ? colors.elev2 : 'transparent',
          })}
        >
          <EntryContent entry={entry} />
        </Pressable>
      </View>
    </GestureDetector>
  );
}

function EntryContent({ entry }: { entry: LogEntry }) {
  const comps = parseComponents(entry.components);
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1, paddingEnd: spacing.sm }}>
        <Text style={font.body} numberOfLines={1}>
          {entry.name}
        </Text>
        {comps ? (
          <Text style={font.tiny} numberOfLines={1}>
            {comps.map((c) => c.name).join(', ')}
          </Text>
        ) : null}
        <Text style={font.tiny}>
          {Math.round(entry.grams)} ג׳ · ח {Math.round(entry.protein)} · פ {Math.round(entry.carbs)} · ש {Math.round(entry.fat)}
        </Text>
      </View>
      <Text style={[font.body, { fontWeight: '600' }]}>{Math.round(entry.kcal)}</Text>
    </Row>
  );
}
