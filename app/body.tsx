import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { ApiKeyPrompt } from '../src/components/ApiKeyPrompt';
import { TrendChart } from '../src/components/charts';
import { SectionHeading } from '../src/components/insights';
import { Button, Card, CardHeader, Field, Pill, Row, Screen, Segmented, Stat, parseNum } from '../src/components/ui';
import { UnusablePhotosError, analyzeBody, deleteScan, loadScans, photoExists, saveScan, type BodyPhoto } from '../src/body/analysis';
import { MUSCULARITY_LABEL, bodyFatCategory, compareScans, composition, type BodyScan, type ScanDelta } from '../src/body/model';
import { MissingApiKeyError, describeAiError, hasApiKey } from '../src/lib/ai';
import { weightInsights, weightSeries } from '../src/lib/analytics';
import { formatShortDate, today } from '../src/lib/dates';
import { displayToKg, kgToDisplay, weightLabel, type Units } from '../src/lib/units';
import { useApp } from '../src/state/store';
import { colors, font, radius, spacing } from '../src/theme';

const CONFIDENCE = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' } as const;

export default function Body() {
  const { profile } = useApp();
  const { width } = useWindowDimensions();
  const [scans, setScans] = useState<BodyScan[]>([]);
  const [front, setFront] = useState<BodyPhoto | null>(null);
  const [side, setSide] = useState<BodyPhoto | null>(null);
  const [weightText, setWeightText] = useState('');
  const [pending, setPending] = useState<BodyScan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'front' | 'side'>('front');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [keyReady, setKeyReady] = useState<boolean | null>(null);
  const units: Units = profile?.units ?? 'metric';
  const wl = weightLabel(units);

  useEffect(() => {
    hasApiKey().then(setKeyReady);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [list, series] = await Promise.all([loadScans(), weightSeries(30)]);
        if (!alive) return;
        setScans(list);
        const kg = weightInsights(series.all).currentKg;
        if (kg != null) setWeightText((t) => t || kgToDisplay(kg, units).toFixed(1));
      })().catch(() => {});
      return () => {
        alive = false;
      };
    }, [units]),
  );

  if (!profile) return null;

  async function pick(slot: 'front' | 'side', fromCamera: boolean) {
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled) return;
    const a = res.assets[0];
    (slot === 'front' ? setFront : setSide)({ uri: a.uri, width: a.width, height: a.height });
    setPending(null);
    setError('');
  }

  async function analyze() {
    if (!front || !side || !profile) return;
    const w = parseNum(weightText);
    setBusy(true);
    setError('');
    try {
      const scan = await analyzeBody({
        front,
        side,
        date: today(),
        weightKg: w != null && w > 0 ? Math.round(displayToKg(w, units) * 10) / 10 : null,
        heightCm: profile.height_cm,
        sex: profile.sex,
        age: new Date().getFullYear() - profile.birth_year,
        previous: scans[0] ?? null,
      });
      setPending(scan);
    } catch (e) {
      if (e instanceof MissingApiKeyError) setKeyReady(false);
      else if (e instanceof UnusablePhotosError) setError(e.message);
      else setError(describeAiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!pending) return;
    setBusy(true);
    try {
      const saved = await saveScan(pending);
      setScans(await loadScans());
      setSelectedId(saved.id);
      setPending(null);
      setFront(null);
      setSide(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(s: BodyScan) {
    Alert.alert('מחיקת סריקה', `${formatShortDate(s.date)}: ${s.bodyFatPct}% שומן`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחיקה',
        style: 'destructive',
        onPress: async () => {
          await deleteScan(s);
          if (selectedId === s.id) setSelectedId(null);
          setScans(await loadScans());
        },
      },
    ]);
  }

  const latest = scans[0] ?? null;
  const first = scans.length > 1 ? scans[scans.length - 1] : null;
  const selected = scans.find((s) => s.id === selectedId) ?? latest;
  const chrono = [...scans].reverse();
  const chartW = width - spacing.lg * 2 - 34;
  const photoW = (width - spacing.lg * 2 - 34 - spacing.md) / 2;

  return (
    <Screen>
      {keyReady === false ? <ApiKeyPrompt onSaved={() => setKeyReady(true)} /> : null}

      <Card style={keyReady === false ? { opacity: 0.4 } : undefined} pointerEvents={keyReady === false ? 'none' : 'auto'}>
        <CardHeader title="סריקה חדשה" subtitle="תמונה מקדימה ותמונה מהצד" color={colors.weight} />
        <Text style={[font.small, { marginBottom: spacing.md }]}>
          לתוצאות עקביות: אותו מקום, אותה תאורה ושעה (בבוקר, לפני אוכל), בגדים צמודים או בגד ים, ידיים מעט רחוקות מהגוף.
        </Text>
        <Row style={{ gap: spacing.md, alignItems: 'flex-start' }}>
          <PhotoSlot label="מקדימה" photo={front} width={photoW} onPick={(cam) => pick('front', cam)} />
          <PhotoSlot label="מהצד" photo={side} width={photoW} onPick={(cam) => pick('side', cam)} />
        </Row>
        <Field
          label="משקל נוכחי"
          suffix={wl}
          keyboardType="decimal-pad"
          value={weightText}
          onChangeText={setWeightText}
          placeholder="משמש לחישוב מסת שומן ומסה רזה"
          style={{ marginTop: spacing.sm }}
        />
        <Button title={latest ? 'ניתוח והשוואה לסריקה הקודמת' : 'ניתוח'} onPress={analyze} loading={busy && !pending} disabled={!front || !side} />
        {error ? <Text style={[font.small, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text> : null}
        <Text style={[font.tiny, { marginTop: spacing.sm }]}>
          התמונות נשלחות ל-Gemini לניתוח ונשמרות רק בטלפון. הערכה חזותית סוטה בדרך כלל ב-3–5 נקודות אחוז; המגמה לאורך זמן חשובה יותר מהמספר הבודד.
        </Text>
      </Card>

      {pending ? (
        <>
          <ScanDetails scan={pending} sex={profile.sex} units={units} delta={latest ? compareScans(latest, pending) : null} />
          <Row style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <Button title="שמירה" style={{ flex: 1 }} onPress={save} loading={busy} />
            <Button title="ביטול" variant="secondary" style={{ flex: 1 }} onPress={() => setPending(null)} />
          </Row>
        </>
      ) : null}

      {scans.length ? (
        <>
          <SectionHeading>התקדמות</SectionHeading>
          {scans.length > 1 ? (
            <Card>
              <CardHeader title="אחוז שומן" subtitle={`${scans.length} סריקות`} color={colors.weight} />
              <TrendChart
                width={chartW}
                height={180}
                color={colors.weight}
                decimals={1}
                points={chrono.map((s) => ({ trend: s.bodyFatPct, lo: s.bodyFatLow, hi: s.bodyFatHigh }))}
                bandColor={colors.weightSoft}
                labels={chrono.map((s, i) => (i === 0 || i === chrono.length - 1 || chrono.length <= 5 ? formatShortDate(s.date) : ''))}
              />
              {first && latest ? <DeltaRow title={`מאז הסריקה הראשונה (${formatShortDate(first.date)})`} delta={compareScans(first, latest)} units={units} /> : null}
            </Card>
          ) : null}

          {first && latest ? (
            <Card>
              <CardHeader
                title="לפני ואחרי"
                right={<Segmented options={[{ value: 'front', label: 'מקדימה' }, { value: 'side', label: 'מהצד' }]} value={view} onChange={setView} style={{ width: 150, marginBottom: 0 }} />}
              />
              <Row style={{ gap: spacing.md }}>
                {[first, latest].map((s) => (
                  <View key={s.id} style={{ flex: 1 }}>
                    <StoredPhoto uri={view === 'front' ? s.frontUri : s.sideUri} width={photoW} />
                    <Text style={[font.small, { textAlign: 'center', marginTop: 4 }]}>
                      {formatShortDate(s.date)} · {s.bodyFatPct}%
                    </Text>
                  </View>
                ))}
              </Row>
            </Card>
          ) : null}

          {selected ? (
            <ScanDetails
              scan={selected}
              sex={profile.sex}
              units={units}
              delta={(() => {
                const i = scans.indexOf(selected);
                return i >= 0 && i < scans.length - 1 ? compareScans(scans[i + 1], selected) : null;
              })()}
              showPhotos={photoW}
            />
          ) : null}

          <Card style={{ padding: 0 }}>
            {scans.map((s, i) => {
              const c = composition(s);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  onLongPress={() => confirmDelete(s)}
                  style={{ padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: s.id === selected?.id ? colors.elev2 : undefined }}
                >
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={font.body}>{formatShortDate(s.date)}</Text>
                    <Text style={[font.body, { fontWeight: '700' }]}>
                      {s.bodyFatPct}% שומן{c ? ` · ${fmtKg(c.leanKg, units)} רזה` : ''}
                    </Text>
                  </Row>
                </Pressable>
              );
            })}
          </Card>
          <Text style={[font.tiny, { textAlign: 'center' }]}>לחיצה על סריקה לפרטים · לחיצה ארוכה למחיקה</Text>
        </>
      ) : null}
    </Screen>
  );
}

function fmtKg(kg: number, units: Units) {
  return `${kgToDisplay(kg, units).toFixed(1)} ${weightLabel(units)}`;
}

function signed(v: number, digits = 1) {
  const s = Math.abs(v).toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
}

function PhotoSlot({ label, photo, width, onPick }: { label: string; photo: BodyPhoto | null; width: number; onPick: (camera: boolean) => void }) {
  return (
    <View style={{ width }}>
      <Pressable
        onPress={() => onPick(true)}
        style={{ width, aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.elev2, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
      >
        {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={font.small}>{label}</Text>}
      </Pressable>
      <Row style={{ gap: spacing.xs, marginTop: spacing.xs }}>
        <Button title="צילום" size="sm" variant={photo ? 'secondary' : 'primary'} style={{ flex: 1 }} onPress={() => onPick(true)} />
        <Button title="גלריה" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => onPick(false)} />
      </Row>
    </View>
  );
}

function StoredPhoto({ uri, width }: { uri: string; width: number }) {
  const ok = photoExists(uri);
  return (
    <View style={{ width, aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.elev2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {ok ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={[font.tiny, { textAlign: 'center', padding: spacing.sm }]}>התמונה לא נמצאת במכשיר הזה</Text>}
    </View>
  );
}

function DeltaRow({ title, delta, units }: { title: string; delta: ScanDelta; units: Units }) {
  const kg = (v: number | null) => (v == null ? '—' : signed(kgToDisplay(v, units)));
  return (
    <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
      <Text style={[font.label, { marginBottom: spacing.sm }]}>
        {title}
        {delta.days > 0 ? ` · ${delta.days} ימים` : ''}
      </Text>
      <Row style={{ gap: spacing.md }}>
        <Stat label="אחוז שומן" value={signed(delta.bodyFatPct)} sub="%" color={delta.bodyFatPct <= 0 ? colors.success : colors.warning} />
        <Stat label="מסת שומן" value={kg(delta.fatKg)} sub={weightLabel(units)} color={(delta.fatKg ?? 0) <= 0 ? colors.success : colors.warning} />
        <Stat label="מסה רזה" value={kg(delta.leanKg)} sub={weightLabel(units)} color={(delta.leanKg ?? 0) >= 0 ? colors.success : colors.warning} />
      </Row>
    </View>
  );
}

function ScanDetails({ scan, sex, units, delta, showPhotos }: { scan: BodyScan; sex: 'male' | 'female'; units: Units; delta: ScanDelta | null; showPhotos?: number }) {
  const c = composition(scan);
  return (
    <Card>
      <CardHeader
        title={`סריקה · ${formatShortDate(scan.date)}`}
        subtitle={`ודאות ${CONFIDENCE[scan.confidence]}`}
        color={colors.weight}
        right={<Pill text={bodyFatCategory(scan.bodyFatPct, sex)} color={colors.weight} />}
      />
      {showPhotos ? (
        <Row style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <StoredPhoto uri={scan.frontUri} width={showPhotos} />
          <StoredPhoto uri={scan.sideUri} width={showPhotos} />
        </Row>
      ) : null}
      <Row style={{ alignItems: 'baseline', gap: spacing.sm }}>
        <Text style={[font.display, { color: colors.weight }]}>{scan.bodyFatPct}%</Text>
        <Text style={font.small}>
          שומן · טווח {scan.bodyFatLow}–{scan.bodyFatHigh}%
        </Text>
      </Row>
      {c ? (
        <Row style={{ gap: spacing.md, marginTop: spacing.md }}>
          <Stat label="מסת שומן" value={kgToDisplay(c.fatKg, units).toFixed(1)} sub={weightLabel(units)} color={colors.fat} />
          <Stat label="מסה רזה" value={kgToDisplay(c.leanKg, units).toFixed(1)} sub={weightLabel(units)} color={colors.protein} />
          <Stat label="מסת שריר (הערכה)" value={kgToDisplay(c.muscleKg, units).toFixed(1)} sub={weightLabel(units)} color={colors.success} />
        </Row>
      ) : (
        <Text style={[font.tiny, { marginTop: spacing.sm }]}>בלי משקל אי אפשר לחשב מסת שומן ומסת שריר.</Text>
      )}
      <Text style={[font.small, { marginTop: spacing.md }]}>
        שריריות: <Text style={{ color: colors.text, fontWeight: '700' }}>{MUSCULARITY_LABEL[scan.muscularity]}</Text> ({scan.muscularity}/5)
      </Text>
      {scan.summary ? <Text style={[font.body, { marginTop: spacing.sm }]}>{scan.summary}</Text> : null}
      {scan.regions.map((r, i) => (
        <Text key={i} style={[font.small, { marginTop: spacing.xs }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{r.area}: </Text>
          {r.note}
        </Text>
      ))}
      {scan.comparison ? (
        <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
          <Text style={[font.label, { marginBottom: 4 }]}>מה השתנה מהסריקה הקודמת</Text>
          <Text style={font.body}>{scan.comparison}</Text>
        </View>
      ) : null}
      {delta ? <DeltaRow title="לעומת הסריקה הקודמת" delta={delta} units={units} /> : null}
    </Card>
  );
}
