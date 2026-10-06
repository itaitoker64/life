import { usePlanning } from '../../src/planning/store';
import { Ionicons } from '@expo/vector-icons';
import { TrainingJournal } from '../../src/components/TrainingJournal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NoPlanCard, PaceRange, ReadinessCard, RunHero, RunWeekStrip } from '../../src/components/run';
import { Menu, toast } from '../../src/components/sheet';
import { CoachLink, DeloadCard, MuscleCard, RoutineCard, StrengthHero, WeekGoalCard, useStartWorkout } from '../../src/components/strengthCards';
import { Button, Card, ListRow, Row, SectionTitle, Segmented } from '../../src/components/ui';
import { addDays, toISODate, weekdayNarrow } from '../../src/lib/dates';
import { WORKOUT_META } from '../../src/run/format';
import { R, hasIntervals, latestAssessment, planFor, recalibratePlan, syncIntervals, useRun, useRunVersion } from '../../src/run/store';
import { L, deleteRoutine, duplicateRoutine, moveRoutine, routines, saveRoutine, useLiftVersion } from '../../src/strength/store';
import type { Routine } from '../../src/strength/types';
import { deepClone } from '../../src/strength/utils';
import { startEmpty } from '../../src/strength/workout';
import { chevronBack, chevronForward, colors, font, radius, spacing } from '../../src/theme';

export default function Train() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'strength' | 'run' | 'journal'>(params.tab === 'journal' ? 'journal' : params.tab === 'run' ? 'run' : 'strength');
  useEffect(() => {
    if (params.tab === 'run' || params.tab === 'strength' || params.tab === 'journal') setTab(params.tab);
  }, [params.tab]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Segmented
          options={[
            { value: 'strength', label: 'כוח' },
            { value: 'run', label: 'ריצה' },
            { value: 'journal', label: 'יומן' },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 0 }}
        />
      </View>
      {tab === 'journal' ? <TrainingJournal /> : tab === 'strength' ? <Strength /> : <Running />}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- strength

function Strength() {
  useLiftVersion();
  const router = useRouter();
  const startWorkout = useStartWorkout();
  const [menuFor, setMenuFor] = useState<Routine | null>(null);
  const list = routines();
  const hasHistory = L.workouts.length > 0;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <StrengthHero />
      {hasHistory ? <WeekGoalCard /> : null}
      <DeloadCard compact />
      <CoachLink />
      {hasHistory ? <MuscleCard /> : null}

      <SectionTitle
        right={
          <Pressable onPress={() => router.push({ pathname: '/strength/routine/[id]', params: { id: 'new' } })} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>חדשה</Text>
          </Pressable>
        }
      >
        רוטינות
      </SectionTitle>
      {list.length ? (
        list.map((r) => <RoutineCard key={r.id} r={r} onMenu={() => setMenuFor(r)} />)
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Ionicons name="barbell-outline" size={30} color={colors.faint} />
          <Text style={[font.small, { marginTop: 6, textAlign: 'center' }]}>אין עדיין רוטינות. צרו אחת, או התחילו אימון ריק והוסיפו תרגילים תוך כדי.</Text>
        </Card>
      )}
      {!L.active ? <Button title="אימון ריק" variant="ghost" icon={<Ionicons name="add" size={18} color={colors.text} />} onPress={() => startWorkout(startEmpty)} /> : null}

      <Card style={{ padding: 0, marginTop: spacing.md }}>
        <ListRow icon="time-outline" title="היסטוריית אימונים" sub={`${L.workouts.length} אימונים`} onPress={() => router.push('/strength/history')} />
        <ListRow icon="list-outline" title="תרגילים" sub="ספרייה, שיאים וגרפים לכל תרגיל" onPress={() => router.push('/strength/exercises')} />
        <ListRow icon="bar-chart-outline" title="סטטיסטיקה ומדידות" sub="נפח שבועי, סטים לשריר, מדידות גוף" onPress={() => router.push('/strength/stats')} last />
      </Card>

      <Menu
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        items={
          menuFor
            ? [
                { label: 'עריכת רוטינה', icon: 'create-outline', onPress: () => router.push({ pathname: '/strength/routine/[id]', params: { id: menuFor.id } }) },
                { label: 'שכפול', icon: 'copy-outline', onPress: () => (duplicateRoutine(menuFor.id), toast('הרוטינה שוכפלה')) },
                { label: 'להזיז למעלה', icon: 'arrow-up', onPress: () => moveRoutine(menuFor.id, -1) },
                { label: 'להזיז למטה', icon: 'arrow-down', onPress: () => moveRoutine(menuFor.id, 1) },
                {
                  label: 'מחיקת רוטינה',
                  icon: 'trash-outline',
                  danger: true,
                  onPress: () => {
                    const copy = deepClone(menuFor);
                    deleteRoutine(menuFor.id);
                    toast(`"${copy.name}" נמחקה`, { action: { label: 'ביטול', onPress: () => saveRoutine(copy) } });
                  },
                },
              ]
            : []
        }
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------- running (Stride)

function Running() {
  useRunVersion();
  const router = useRouter();
  const { syncing, recalibrating } = useRun();
  const [connected, setConnected] = useState(true);
  const todayISO = toISODate(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(todayISO);

  useEffect(() => {
    hasIntervals().then(setConnected);
  }, []);

  const start = useMemo(() => {
    const d = new Date();
    const sunday = toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()));
    return addDays(sunday, weekOffset * 7);
  }, [weekOffset]);
  const days = Array.from({ length: 21 }, (_, i) => addDays(start, i));
  usePlanning(s => s.data);
  const today = planFor(todayISO);
  const sel = planFor(selected);
  const assessment = latestAssessment();
  const adaptations = R.plans.filter((p) => p.adaptation_note && p.plan_date >= todayISO);

  async function refresh() {
    try {
      if (connected) await syncIntervals();
      await recalibratePlan();
      toast('התוכנית עודכנה לפי הנתונים האחרונים');
    } catch (e) {
      Alert.alert('העדכון נכשל', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {today ? <RunHero plan={today} /> : <NoPlanCard connected={connected} />}

      <Button
        title={syncing ? 'מסנכרן ריצות…' : recalibrating ? 'מחשב את התוכנית…' : 'עדכון התוכנית לפי הנתונים'}
        loading={syncing || recalibrating}
        onPress={refresh}
        icon={<Ionicons name="sparkles" size={16} color="#fff" />}
      />
      {assessment ? (
        <Text style={[font.tiny, { textAlign: 'center', marginTop: 6, marginBottom: spacing.md }]}>
          כיול אחרון: {new Date(assessment.assessed_at).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      ) : (
        <View style={{ height: spacing.md }} />
      )}

      {assessment ? <ReadinessCard a={assessment} /> : null}
      <RunWeekStrip />

      <SectionTitle>תוכנית אימונים</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name={chevronBack} size={20} color={colors.text} />
          </Pressable>
          <Text style={font.h3}>
            {new Date(start).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} –{' '}
            {new Date(days[20]).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
          </Text>
          <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name={chevronForward} size={20} color={colors.text} />
          </Pressable>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {days.slice(0, 7).map((d) => (
            <Text key={`h${d}`} style={[font.tiny, { width: `${100 / 7}%`, textAlign: 'center', marginBottom: 4 }]}>
              {weekdayNarrow(d)}
            </Text>
          ))}
          {days.map((d) => {
            const p = planFor(d);
            const isSel = d === selected;
            const isToday = d === todayISO;
            return (
              <Pressable key={d} onPress={() => setSelected(d)} style={{ width: `${100 / 7}%`, padding: 2 }}>
                <View
                  style={{
                    aspectRatio: 0.85,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    backgroundColor: isSel ? colors.primary : isToday ? colors.primarySoft : 'transparent',
                  }}
                >
                  <Text style={{ color: isSel ? '#fff' : d < todayISO ? colors.faint : colors.text, fontWeight: '700', fontSize: 13 }}>{Number(d.slice(8))}</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p ? (isSel ? '#fff' : WORKOUT_META[p.workout_type].color) : 'transparent' }} />
                  {p?.status === 'completed' && !isSel ? <View style={{ position: 'absolute', bottom: 3, left: 8, right: 8, height: 2, borderRadius: 1, backgroundColor: colors.success }} /> : null}
                  {p?.adaptation_note ? <View style={{ position: 'absolute', top: 4, end: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.flame }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {sel ? (
        <Pressable onPress={() => router.push({ pathname: '/run/day/[date]', params: { date: selected } })}>
          <Card style={{ borderColor: WORKOUT_META[sel.workout_type].color }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: WORKOUT_META[sel.workout_type].color, fontWeight: '700', fontSize: 12 }}>{WORKOUT_META[sel.workout_type].label}</Text>
              <Text style={font.tiny}>{new Date(selected).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            </Row>
            <Text style={[font.h2, { marginTop: 6 }]}>{sel.title}</Text>
            {sel.workout_type !== 'rest' ? (
              <Row style={{ gap: spacing.lg, marginTop: 8 }}>
                <View>
                  <Text style={font.tiny}>קצב</Text>
                  <PaceRange fast={sel.target_pace_fast_sec_km} slow={sel.target_pace_slow_sec_km} style={[font.h3]} />
                </View>
                <View>
                  <Text style={font.tiny}>משך</Text>
                  <Text style={font.h3}>{sel.duration_min ?? '–'} דק׳</Text>
                </View>
                <View>
                  <Text style={font.tiny}>מרחק</Text>
                  <Text style={font.h3}>{sel.distance_km ?? '–'} ק״מ</Text>
                </View>
              </Row>
            ) : null}
            {sel.description ? (
              <Text style={[font.small, { marginTop: 8, lineHeight: 19 }]} numberOfLines={3}>
                {sel.description}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text style={font.small}>עדיין לא נקבע אימון ליום הזה.</Text>
        </Card>
      )}

      {adaptations.length ? (
        <>
          <SectionTitle>התאמות דינמיות</SectionTitle>
          {adaptations.map((p) => (
            <Pressable key={p.id} onPress={() => setSelected(p.plan_date)}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: 'rgba(255,138,61,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={p.adjustment_sec > 0 ? 'trending-down' : p.adjustment_sec < 0 ? 'trending-up' : 'color-wand-outline'} size={18} color={colors.flame} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { fontWeight: '700' }]}>
                    {new Date(p.plan_date).toLocaleDateString('he-IL', { weekday: 'long' })} · {p.title}
                  </Text>
                  <Text style={font.tiny} numberOfLines={1}>
                    {p.adaptation_note}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      <Card style={{ padding: 0, marginTop: spacing.md }}>
        <ListRow icon="walk-outline" iconColor={colors.run} title="היסטוריית ריצות" sub={`${R.activities.length} ריצות`} onPress={() => router.push('/run/history')} />
        <ListRow icon="trophy-outline" iconColor={colors.pr} title="יעדים, מרוצים וכושר" sub="VDOT, אזורי קצב, תחזיות זמן" onPress={() => router.push('/run/goals')} last />
      </Card>
    </ScrollView>
  );
}
