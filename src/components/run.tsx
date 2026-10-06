// Running cards, ported from Stride's TodayView / PlanView (React + Tailwind → React Native).
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { addDays, toISODate, weekdayNarrow } from '../lib/dates';
import { HR_ZONES, WORKOUT_META, FATIGUE_HE, formatDuration, formatKm, formatPace, zoneBpm } from '../run/format';
import { R, plansBetween, setPlanStatus, weeklyKm } from '../run/store';
import type { Activity, CoachAssessment, CoachingPlan } from '../run/types';
import { chevronForward, colors, font, radius, spacing } from '../theme';
import { Card, Row } from './ui';
import { toast } from './sheet';

export function PaceRange({ fast, slow, style }: { fast: number | null; slow: number | null; style?: object }) {
  if (fast == null && slow == null) return <Text style={style}>–</Text>;
  return (
    <Text style={[{ writingDirection: 'ltr' }, style]}>
      {formatPace(fast)}–{formatPace(slow)}
    </Text>
  );
}

function shade(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Today's planned run: Stride's hero card. */
export function RunHero({ plan, compact }: { plan: CoachingPlan; compact?: boolean }) {
  const router = useRouter();
  const meta = WORKOUT_META[plan.workout_type];
  const isRest = plan.workout_type === 'rest';
  const bpm = plan.hr_zone ? zoneBpm(plan.hr_zone, R.profile.hr_max, R.profile.hr_rest) : null;
  const done = plan.status === 'completed';
  const skipped = plan.status === 'skipped';

  function mark(status: 'completed' | 'skipped') {
    const next = plan.status === status ? 'planned' : status;
    setPlanStatus(plan, next);
    if (next === 'completed') toast('כל הכבוד! עוד אימון בכיס 💪');
  }

  return (
    <Pressable onPress={() => router.push({ pathname: '/run/day/[date]', params: { date: plan.plan_date } })}>
      <LinearGradient
        colors={[shade(meta.color, 0.35), shade(meta.color, 0.12), colors.card]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: shade(meta.color, 0.4), padding: 16, marginBottom: spacing.md }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: shade(meta.color, 0.25), paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}>
            <Ionicons name={isRest ? 'moon-outline' : 'walk-outline'} size={13} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{meta.label}</Text>
          </View>
          <Text style={font.tiny}>ריצה · היום</Text>
        </Row>
        <Text style={[font.h1, { marginTop: 10, fontSize: compact ? 22 : 26 }]}>{plan.title}</Text>
        {isRest ? (
          <Text style={[font.small, { marginTop: 6, lineHeight: 19 }]}>{plan.description ?? plan.rationale}</Text>
        ) : (
          <>
            <Text style={[font.tiny, { marginTop: 10 }]}>טווח קצב יעד (דק׳/ק״מ)</Text>
            <PaceRange fast={plan.target_pace_fast_sec_km} slow={plan.target_pace_slow_sec_km} style={{ color: colors.text, fontSize: 34, fontWeight: '900', textAlign: 'left' }} />
            <Row style={{ gap: spacing.md, marginTop: 10 }}>
              <HeroStat icon="time-outline" label="משך" value={plan.duration_min ?? '–'} unit="דק׳" />
              <HeroStat icon="navigate-outline" label="מרחק" value={plan.distance_km ?? '–'} unit="ק״מ" />
              <HeroStat icon="heart-outline" label={`אזור ${plan.hr_zone ?? '–'}`} value={bpm ? `${bpm[0]}–${bpm[1]}` : '–'} unit="" />
            </Row>
          </>
        )}
        {plan.adaptation_note ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.25)' }}>
            <Ionicons name={plan.adjustment_sec > 0 ? 'trending-down' : 'trending-up'} size={16} color={colors.flame} />
            <Text style={[font.small, { flex: 1, color: colors.text }]}>{plan.adaptation_note}</Text>
          </View>
        ) : null}
        {!compact ? (
          <Text style={[font.small, { marginTop: 10, lineHeight: 19 }]} numberOfLines={4}>
            {plan.rationale}
          </Text>
        ) : null}
        {!isRest ? (
          <Row style={{ gap: spacing.sm, marginTop: 14 }}>
            <Pressable
              onPress={() => mark('completed')}
              style={{
                flex: 1,
                flexDirection: 'row',
                gap: 6,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                borderRadius: radius.md,
                backgroundColor: done ? colors.success : colors.text,
              }}
            >
              <Ionicons name="checkmark" size={20} color={done ? '#05240f' : colors.bg} />
              <Text style={{ fontWeight: '800', color: done ? '#05240f' : colors.bg }}>{done ? 'הושלם!' : 'סיימתי'}</Text>
            </Pressable>
            <Pressable
              onPress={() => mark('skipped')}
              accessibilityLabel="דילגתי על האימון"
              style={{
                width: 52,
                minHeight: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: skipped ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </Row>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

function HeroStat({ icon, label, value, unit }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; unit: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Row style={{ gap: 4 }}>
        <Ionicons name={icon} size={12} color={colors.muted} />
        <Text style={font.tiny}>{label}</Text>
      </Row>
      <Text style={[font.h2, { marginTop: 2 }]}>
        {value}
        {unit ? <Text style={font.tiny}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function NoPlanCard({ connected }: { connected: boolean }) {
  const router = useRouter();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <Ionicons name="walk-outline" size={30} color={colors.run} />
      <Text style={[font.h3, { marginTop: spacing.sm }]}>{connected ? 'אין עדיין אימון ריצה להיום' : 'חברו את Garmin'}</Text>
      <Text style={[font.small, { textAlign: 'center', marginTop: 4, marginBottom: spacing.md }]}>
        {connected ? 'התוכנית נבנית מהריצות שלך — לחצו על “עדכון התוכנית”.' : 'דרך intervals.icu, כדי לקבל תוכנית ריצה מבוססת מחקר.'}
      </Text>
      {!connected ? (
        <Pressable onPress={() => router.push('/settings')}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>להגדרות</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function ReadinessCard({ a }: { a: CoachAssessment }) {
  const f = FATIGUE_HE[a.fatigue_level];
  const c = a.readiness_score >= 70 ? colors.success : a.readiness_score >= 45 ? colors.warning : colors.danger;
  return (
    <Card style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 8, borderColor: c, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[font.h1, { fontSize: 26 }]}>{a.readiness_score}</Text>
        <Text style={font.tiny}>מוכנות</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <View style={{ backgroundColor: shade(f.color, 0.18), paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }}>
            <Text style={{ color: f.color, fontSize: 12, fontWeight: '700' }}>{f.label}</Text>
          </View>
          {a.acwr != null ? (
            <View style={{ backgroundColor: colors.elev2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>ACWR {a.acwr.toFixed(2)}</Text>
            </View>
          ) : null}
          {a.vdot != null ? (
            <View style={{ backgroundColor: colors.elev2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>VDOT {a.vdot}</Text>
            </View>
          ) : null}
        </Row>
        <Text style={[font.small, { marginTop: 6, lineHeight: 19 }]}>{a.summary}</Text>
      </View>
    </Card>
  );
}

/** This week's km vs target and a 7-day strip of planned/done runs. */
export function RunWeekStrip() {
  const router = useRouter();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const startISO = toISODate(start);
  const days = Array.from({ length: 7 }, (_, i) => addDays(startISO, i));
  const plan = plansBetween(days[0], days[6]);
  const week = weeklyKm(1)[0];
  const plannedKm = plan.reduce((s, p) => s + (p.distance_km ?? 0), 0);
  const goal = R.profile.weekly_km_target ?? Math.round(plannedKm);
  const pct = goal ? Math.min(1, week.km / goal) : 0;
  const todayISO = toISODate(now);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={font.h1}>
          {week.km.toFixed(1)}
          <Text style={font.small}> / {goal} ק״מ</Text>
        </Text>
        <Text style={font.tiny}>{week.runs} ריצות השבוע</Text>
      </Row>
      <View style={{ height: 8, backgroundColor: colors.elev2, borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.run, borderRadius: 4 }} />
      </View>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}>
        {days.map((d) => {
          const p = plan.find((x) => x.plan_date === d);
          const isToday = d === todayISO;
          const color = p ? WORKOUT_META[p.workout_type].color : 'transparent';
          return (
            <Pressable key={d} onPress={() => p && router.push({ pathname: '/run/day/[date]', params: { date: d } })} style={{ alignItems: 'center', gap: 4 }}>
              <Text style={[font.tiny, isToday && { color: colors.primary, fontWeight: '700' }]}>{weekdayNarrow(d)}</Text>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: p?.status === 'completed' ? colors.success : isToday ? colors.primary : colors.elev2,
                }}
              >
                {p?.status === 'completed' ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={{ color: p?.status === 'skipped' ? colors.faint : colors.text, fontWeight: '700', textDecorationLine: p?.status === 'skipped' ? 'line-through' : 'none' }}>
                    {Number(d.slice(8))}
                  </Text>
                )}
              </View>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
            </Pressable>
          );
        })}
      </Row>
    </Card>
  );
}

export function RunRow({ a, onPress }: { a: Activity; onPress?: () => void }) {
  const d = new Date(a.start_time);
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={{ flexDirection: 'row', padding: 0, overflow: 'hidden' }}>
        <View style={{ width: 78, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.runSoft, paddingVertical: 12 }}>
          <Text style={{ color: colors.run, fontSize: 24, fontWeight: '900' }}>{formatKm(a.distance_m, 1)}</Text>
          <Text style={{ color: colors.run, fontSize: 11, fontWeight: '700' }}>ק״מ</Text>
        </View>
        <View style={{ flex: 1, padding: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[font.h3, { flex: 1 }]} numberOfLines={1}>
              {a.name ?? 'ריצה'}
            </Text>
            <Text style={font.tiny}>
              {d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
          </Row>
          <Row style={{ marginTop: 8, gap: spacing.md }}>
            <Metric label="זמן" value={formatDuration(a.duration_s)} />
            <Metric label="קצב" value={formatPace(a.avg_pace_sec_per_km)} />
            <Metric label="GAP" value={formatPace(a.gap_sec_per_km)} />
            <Metric label="דופק" value={a.avg_hr ? String(Math.round(a.avg_hr)) : '–'} />
          </Row>
          {a.elevation_gain_m ? (
            <Text style={[font.tiny, { marginTop: 6 }]}>
              +{Math.round(a.elevation_gain_m)} מ׳ טיפוס{a.training_load != null ? ` · עומס ${Math.round(a.training_load)}` : ''}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={font.tiny}>{label}</Text>
      <Text style={[font.body, { fontWeight: '700', writingDirection: 'ltr' }]}>{value}</Text>
    </View>
  );
}

export function ZoneLegend({ zone }: { zone: number | null }) {
  if (!zone) return null;
  const z = HR_ZONES[zone - 1];
  const bpm = zoneBpm(zone, R.profile.hr_max, R.profile.hr_rest);
  return (
    <Row style={{ gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.elev2, marginTop: spacing.md }}>
      <Ionicons name="heart" size={15} color={z.color} />
      <Text style={font.small}>
        אזור {z.zone} — {z.label} · {bpm[0]}–{bpm[1]} פעימות
      </Text>
    </Row>
  );
}

export function LinkRowSmall({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      <Ionicons name={chevronForward} size={14} color={colors.primary} />
    </Pressable>
  );
}
