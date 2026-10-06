// Races, fitness (VDOT, pace zones, predictions) and records, ported from Stride's GoalsView.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { BarChart } from '../../src/components/charts';
import { PaceRange } from '../../src/components/run';
import { Sheet, toast } from '../../src/components/sheet';
import { Button, Card, Chip, DateStepper, Field, Row, Screen, SectionTitle } from '../../src/components/ui';
import { addDays, toISODate, today } from '../../src/lib/dates';
import { PHASE_HE, RACE_DISTANCES, ZONE_INFO, formatDuration, formatPace, parseTime } from '../../src/run/format';
import { R, addRace, deleteRace, latestAssessment, recalibratePlan, upcomingRaces, useRunVersion, weeklyKm } from '../../src/run/store';
import type { Race } from '../../src/run/types';
import { colors, font, radius, spacing } from '../../src/theme';

export default function Goals() {
  useRunVersion();
  const { width } = useWindowDimensions();
  const [adding, setAdding] = useState(false);
  const a = latestAssessment();
  const races = upcomingRaces();
  const km = weeklyKm(8);
  const longest = R.activities.slice().sort((x, y) => y.distance_m - x.distance_m)[0];
  const fastest = R.activities.filter((x) => x.distance_m >= 3000 && x.avg_pace_sec_per_km).sort((x, y) => x.avg_pace_sec_per_km! - y.avg_pace_sec_per_km!)[0];
  const climb = R.activities.slice().sort((x, y) => (y.elevation_gain_m ?? 0) - (x.elevation_gain_m ?? 0))[0];

  return (
    <Screen bottomInset={false}>
      <SectionTitle
        right={
          <Pressable onPress={() => setAdding(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700' }}>מרוץ</Text>
          </Pressable>
        }
      >
        מרוצים
      </SectionTitle>
      {!races.length ? (
        <Card>
          <Text style={[font.small, { textAlign: 'center' }]}>הוסיפו מרוץ עם זמן יעד — התוכנית תיבנה סביבו (בסיס ← בנייה ← ספציפי ← טייפר).</Text>
        </Card>
      ) : null}
      {races.map((r, i) => (
        <RaceCard key={r.id} race={r} featured={i === 0} prediction={a?.race_predictions?.find((p) => p.name === r.name)?.predicted_s ?? null} />
      ))}

      {a ? (
        <>
          <SectionTitle>כושר</SectionTitle>
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={font.label}>VDOT</Text>
                <Text style={[font.display, { color: colors.run }]}>{a.vdot ?? '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={font.small}>{a.phase ? PHASE_HE[a.phase] ?? a.phase : ''}</Text>
                <Text style={font.tiny}>יעד השבוע {a.weekly_km_target ?? '—'} ק״מ</Text>
                <Text style={font.tiny}>
                  {a.vdot_source === 'heart_rate' || a.vdot_source === 'blended' ? 'לפי ביצועים ודופק' : a.vdot_source === 'default' ? 'הערכה ראשונית' : 'לפי ביצועים'}
                </Text>
              </View>
            </Row>
            {a.marathon_shape_pct != null && races.some((r) => r.distance_km > 40) ? (
              <View style={{ marginTop: spacing.md }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={font.small}>מוכנות למרתון</Text>
                  <Text style={[font.body, { fontWeight: '800' }]}>{a.marathon_shape_pct}%</Text>
                </Row>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.elev2, marginTop: 4, overflow: 'hidden' }}>
                  <View style={{ width: `${a.marathon_shape_pct}%`, height: '100%', backgroundColor: colors.run }} />
                </View>
              </View>
            ) : null}
          </Card>

          {a.training_paces ? (
            <>
              <SectionTitle>אזורי קצב (דניאלס)</SectionTitle>
              <Card>
                {ZONE_INFO.map((z, i) => {
                  const p = a.training_paces![z.key];
                  return (
                    <Row key={z.key} style={{ gap: spacing.md, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: z.color }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[font.body, { fontWeight: '700' }]}>{z.label}</Text>
                        <Text style={font.tiny}>{z.desc}</Text>
                      </View>
                      <PaceRange fast={p.fast} slow={p.slow} style={[font.h3]} />
                    </Row>
                  );
                })}
                <Text style={[font.tiny, { marginTop: 6 }]}>דק׳ לק״מ, מחושב מה-VDOT הנוכחי.</Text>
              </Card>
            </>
          ) : null}
        </>
      ) : (
        <Card>
          <Text style={[font.small, { textAlign: 'center' }]}>אחרי סנכרון ריצות ועדכון התוכנית יופיעו כאן VDOT, אזורי קצב ותחזיות.</Text>
        </Card>
      )}

      <SectionTitle>נפח שבועי (ק״מ)</SectionTitle>
      <Card>
        <BarChart
          width={width - spacing.lg * 2 - 30}
          height={130}
          color={colors.run}
          values={km.map((w) => w.km)}
          labels={km.map((w) => new Date(w.start).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }))}
        />
      </Card>

      {R.activities.length ? (
        <>
          <SectionTitle>שיאים</SectionTitle>
          <Row style={{ gap: spacing.sm }}>
            <Record icon="trophy-outline" color={colors.pr} label="הארוכה ביותר" value={longest ? (longest.distance_m / 1000).toFixed(1) : '—'} unit="ק״מ" />
            <Record icon="flash-outline" color={colors.primary} label="הקצב המהיר" value={formatPace(fastest?.avg_pace_sec_per_km)} unit="/ק״מ" />
            <Record icon="trending-up-outline" color={colors.success} label="טיפוס מקסימלי" value={String(Math.round(climb?.elevation_gain_m ?? 0))} unit="מ׳" />
          </Row>
        </>
      ) : null}

      <AddRace visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function RaceCard({ race, featured, prediction }: { race: Race; featured: boolean; prediction: number | null }) {
  const days = Math.round((Date.parse(race.race_date) - Date.parse(toISODate(new Date()))) / 86_400_000);
  const diff = prediction != null && race.target_time_s ? prediction - race.target_time_s : null;
  return (
    <Card style={featured ? { borderColor: colors.pr } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: race.priority === 'A' ? 'rgba(251,191,36,0.2)' : colors.elev2 }}>
            <Text style={{ color: race.priority === 'A' ? colors.pr : colors.muted, fontWeight: '800', fontSize: 12 }}>מרוץ {race.priority}</Text>
          </View>
          <Text style={font.tiny}>{days === 0 ? 'היום!' : `בעוד ${days} ימים`}</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() =>
            Alert.alert(`למחוק את ${race.name}?`, undefined, [
              { text: 'ביטול', style: 'cancel' },
              { text: 'מחיקה', style: 'destructive', onPress: () => (deleteRace(race.id), recalibratePlan().catch(() => {})) },
            ])
          }
        >
          <Ionicons name="trash-outline" size={18} color={colors.faint} />
        </Pressable>
      </Row>
      <Text style={[font.h2, { marginTop: 6 }]}>{race.name}</Text>
      <Text style={font.small}>
        {new Date(`${race.race_date}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })} · {race.distance_km} ק״מ
      </Text>
      <Row style={{ gap: spacing.xl, marginTop: spacing.sm }}>
        <View>
          <Text style={font.tiny}>יעד</Text>
          <Text style={[font.h3, { writingDirection: 'ltr' }]}>{race.target_time_s ? formatDuration(race.target_time_s) : '—'}</Text>
        </View>
        <View>
          <Text style={font.tiny}>תחזית לפי הכושר</Text>
          <Text style={[font.h3, { writingDirection: 'ltr' }]}>{prediction ? formatDuration(prediction) : '—'}</Text>
        </View>
        {diff != null ? (
          <View>
            <Text style={font.tiny}>פער</Text>
            <Text style={[font.h3, { color: diff <= 0 ? colors.success : colors.warning, writingDirection: 'ltr' }]}>
              {diff <= 0 ? '−' : '+'}
              {formatDuration(Math.abs(diff))}
            </Text>
          </View>
        ) : null}
      </Row>
    </Card>
  );
}

function Record({ icon, color, label, value, unit }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string; unit: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[font.tiny, { marginTop: 4, textAlign: 'center' }]}>{label}</Text>
      <Text style={[font.h3, { writingDirection: 'ltr' }]}>{value}</Text>
      <Text style={font.tiny}>{unit}</Text>
    </Card>
  );
}

function AddRace({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => addDays(today(), 84));
  const [dist, setDist] = useState(21.0975);
  const [target, setTarget] = useState('');
  const [priority, setPriority] = useState<Race['priority']>('A');

  async function submit() {
    const d = date.trim();
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(d) || d < toISODate(new Date())) {
      toast('מלאו שם ותאריך עתידי בפורמט 2026-12-31');
      return;
    }
    const t = target.trim() ? parseTime(target) : null;
    if (target.trim() && t == null) {
      toast('זמן יעד בפורמט 1:45:00 או 45:00');
      return;
    }
    addRace({ name: name.trim(), race_date: d, distance_km: dist, target_time_s: t, priority });
    setName('');
    setDate('');
    setTarget('');
    onClose();
    try {
      await recalibratePlan();
      toast('המרוץ נוסף והתוכנית עודכנה');
    } catch {
      toast('המרוץ נוסף');
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="מרוץ חדש" footer={<Button title="הוספה" onPress={submit} />}>
      <Field label="שם" value={name} onChangeText={setName} placeholder="למשל: מרתון תל אביב" />
      <DateStepper label="תאריך המרוץ" value={date} min={today()} months onChange={setDate} />
      <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>מרחק</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
        {RACE_DISTANCES.map((d) => (
          <Chip key={d.label} label={d.label} active={dist === d.km} onPress={() => setDist(d.km)} />
        ))}
      </View>
      <Field label="זמן יעד (לא חובה)" value={target} onChangeText={setTarget} placeholder="1:45:00" keyboardType="numbers-and-punctuation" />
      <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>עדיפות</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['A', 'B', 'C'] as const).map((p) => (
          <Chip key={p} label={p === 'A' ? 'A — המטרה' : p === 'B' ? 'B — הכנה' : 'C — אימון'} active={priority === p} onPress={() => setPriority(p)} />
        ))}
      </View>
    </Sheet>
  );
}
