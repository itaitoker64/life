import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, Text, View } from 'react-native';
import { ApiKeyPrompt } from '../../src/components/ApiKeyPrompt';
import { useStartWorkout } from '../../src/components/strengthCards';
import { Button, Card, Field, Row, Screen, Segmented, Title } from '../../src/components/ui';
import { today } from '../../src/lib/dates';
import { describeGeminiError, MissingApiKeyError } from '../../src/lib/gemini';
import { getApiKey } from '../../src/lib/secrets';
import { reducedStrengthItems } from '../../src/planning/adaptation';
import { completedSessions, matchSessions, plannedSessions, validDate } from '../../src/planning/model';
import { updatePlanning, usePlanning } from '../../src/planning/store';
import { R, planFor, useRunVersion } from '../../src/run/store';
import { L, useLiftVersion } from '../../src/strength/store';
import { uid } from '../../src/strength/utils';
import { startSpontaneousWorkout } from '../../src/strength/workout';
import { fullBodyItems, crossfitItems, KIND_LABEL, type HybridKind } from '../../src/training/combined';
import { EQUIPMENT, emptyInventory, tailorWorkout, type EquipmentKey, type GymInventory, type WorkoutDraft } from '../../src/training/equipment';
import { clearlyVisibleEquipment, inspectGym, type GymPhoto } from '../../src/training/vision';
import { colors, font } from '../../src/theme';
export default function Spontaneous() {
  useLiftVersion(); useRunVersion();
  const data = usePlanning(s => s.data);
  const params = useLocalSearchParams<{ sessionId?: string; date?: string; draftId?: string }>();
  const router = useRouter(), startWorkout = useStartWorkout();
  const saved = data.workoutDrafts?.find(d => d.id === params.draftId);
  const date = saved?.date ?? (params.date && validDate(params.date) ? params.date : today());
  const plans = plannedSessions(data, R.plans, date, date);
  const matches = matchSessions(plans, completedSessions(L.workouts, R.activities, data));
  const choices = plans.filter(p => p.status !== 'skipped' && !matches.has(p.id));
  const [sourceId, setSourceId] = useState<string | undefined>(saved?.sourceSessionId ?? params.sessionId ?? choices[0]?.id);
  const source = choices.find(p => p.id === sourceId);
  const [kind, setKind] = useState<HybridKind>(saved?.kind ?? source?.kind ?? 'strength');
  const [minutes, setMinutes] = useState(String(saved?.minutes ?? source?.minutes ?? (source?.coachDate ? planFor(source.date)?.duration_min : undefined) ?? 45));
  const [gym, setGym] = useState<GymInventory>(saved?.inventory ?? emptyInventory());
  const [photos, setPhotos] = useState<GymPhoto[]>([]);
  const [observations, setObservations] = useState<Awaited<ReturnType<typeof inspectGym>>['observations']>([]);
  const [notes, setNotes] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [keyReady, setKeyReady] = useState<boolean | null>(null);
  const [draft, setDraft] = useState<WorkoutDraft | null>(saved ?? null);
  const revision = useRef(0);
  useEffect(() => { let live = true; getApiKey().then(key => { if (live) setKeyReady(!!key); }); return () => { live = false; revision.current++; }; }, []);
  function changeGym(value: GymInventory) { revision.current++; setGym(value); setDraft(null); }
  async function pick(camera: boolean) {
    if (busy || photos.length >= 3) return;
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        Alert.alert('נדרשת גישה למצלמה', 'אפשר לאפשר גישה בהגדרות, או לבחור תמונה מהגלריה ולסמן ציוד ידנית.', [{ text: 'סגירה' }, { text: 'הגדרות המכשיר', onPress: () => Linking.openSettings() }]); return;
      }
      const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3 - photos.length, quality: 0.8 });
      if (result.canceled) return;
      revision.current++; setDraft(null); setObservations([]); setNotes('');
      setPhotos(previous => [...previous, ...result.assets.map(a => ({ uri: a.uri, width: a.width, height: a.height }))].slice(0, 3));
    } catch { setError('לא ניתן לפתוח את המצלמה או הגלריה. אפשר לבחור ציוד ידנית.'); }
  }
  async function analyze() {
    const request = ++revision.current; setBusy(true); setError(''); setDraft(null);
    try {
      const result = await inspectGym(photos);
      if (request !== revision.current) return;
      setObservations(result.observations); setNotes(result.notes);
      setGym(g => ({ ...g, equipment: clearlyVisibleEquipment(result.observations) }));
    } catch (e) {
      if (request !== revision.current) return;
      if (e instanceof MissingApiKeyError) setKeyReady(false);
      setError(describeGeminiError(e));
    } finally { if (request === revision.current) setBusy(false); }
  }
  function preview() {
    const duration = Number(minutes);
    if (!Number.isFinite(duration) || duration < 15 || duration > 120) { setError('בחרו מסגרת זמן של 15–120 דקות.'); return; }
    const routine = source?.routineId ? L.routines.find(r => r.id === source.routineId) : undefined;
    const level = data.combinedProgram?.level ?? 'returning';
    const items = routine?.items ?? (kind === 'crossfit' ? crossfitItems(L.exercises, level) : kind === 'run' ? [] : fullBodyItems(L.exercises, 0, level));
    const effectiveDuration = kind === 'run' && source?.adjustment?.mode === 'reduce' ? Math.min(duration, Math.max(10, Math.round((source.minutes ?? duration) * (source.adjustment.factor ?? 0.7)))) : duration;
    const result = tailorWorkout(items, L.exercises, gym, kind, effectiveDuration);
    if (kind !== 'run' && source?.adjustment?.mode === 'reduce') result.rows = result.rows.map(row => ({ ...row, item: reducedStrengthItems([{ ...row.item, repMin: row.item.repMin ?? 8, repMax: row.item.repMax ?? 12, sets: row.item.sets.map(s => ({ ...s, done: false })) }], source.adjustment!.factor ?? 0.7, L.exercises.filter(e => e.tracking === 'cardio').map(e => e.id))[0] }));
    setError('');
    setDraft({ id: saved?.id ?? uid(), date, kind, title: `${source?.title ?? KIND_LABEL[kind]} · מקום מזדמן`, sourceSessionId: source?.id, sourceRoutineId: source?.routineId,
      inventory: { ...gym, equipment: [...gym.equipment] }, ...result, minutes: effectiveDuration, appliedAdjustmentKey: source?.adjustment?.mode === 'reduce' ? source.adjustment.key : undefined, createdAt: Date.now() });
  }
  async function save(start: boolean) {
    if (!draft || !draft.rows.length) return;
    if (start && date !== today()) return Alert.alert('טיוטה לתאריך אחר', 'שמרו את הטיוטה ופתחו אותה ביום האימון.');
    if (draft.sourceSessionId && !choices.some(p => p.id === draft.sourceSessionId)) return Alert.alert('השיבוץ השתנה', 'בחרו מחדש איזה אימון להחליף ובדקו את ההתאמה.');
    setSaving(true);
    try {
      await updatePlanning(d => ({ ...d, workoutDrafts: [draft, ...(d.workoutDrafts ?? []).filter(w => w.id !== draft.id)].slice(0, 30) }));
      if (start) startWorkout(() => startSpontaneousWorkout(draft));
      else Alert.alert('הטיוטה נשמרה', 'האימון עדיין לא סומן כבוצע. הוא ייספר רק לאחר סיום ושמירת האימון.');
    } catch { setError('לא ניתן לשמור את ההתאמה. נסו שוב.'); } finally { setSaving(false); }
  }
  return <Screen><Title sub={`${date} · התאמה חד־פעמית`}>חדר כושר מזדמן</Title>
    <Card style={{ gap: 12 }}><Text style={font.h3}>1 · האימון שאותו מתאימים</Text>{choices.map(p => <Button key={p.id} size="sm" title={`${KIND_LABEL[p.kind]} · ${p.title}`} variant={sourceId === p.id ? 'primary' : 'secondary'} onPress={() => { setSourceId(p.id); setKind(p.kind); setMinutes(String(p.minutes ?? 45)); setDraft(null); }} />)}
      <Button title="אימון חדש מעבר לתכנון" size="sm" variant={!sourceId ? 'primary' : 'secondary'} onPress={() => { setSourceId(undefined); setDraft(null); }} />
      {!source ? <Segmented options={(['strength','run','crossfit'] as const).map(value => ({ value, label: KIND_LABEL[value] }))} value={kind} onChange={value => { setKind(value); setDraft(null); }} /> : null}
      {source?.adjustment ? <Text style={font.small}>{source.adjustment.reason}</Text> : null}
      <Field label="מסגרת זמן בדקות (15–120)" value={minutes} keyboardType="numeric" onChangeText={value => { setMinutes(value); setDraft(null); }} />
      <Text style={font.tiny}>{source ? 'ההתאמה מחליפה את השיבוץ רק אחרי סיום האימון. החלוקה והרוטינה המקורית נשמרות.' : 'זה אימון נוסף. לאחר שיישמר, העומס שלו יילקח בחשבון בהמשך השבוע.'}</Text>
    </Card>
    <Card style={{ gap: 12 }}><Text style={font.h3}>2 · צילום וזיהוי ציוד</Text><Text style={font.small}>צלמו עד שלוש זוויות של הציוד. בלחיצה על זיהוי התמונות נשלחות ל־Gemini עם המפתח שלך. אפשר גם לבחור ציוד ידנית ללא תמונות או מפתח.</Text>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}><Button title="צילום החדר" onPress={() => pick(true)} disabled={busy || photos.length >= 3} /><Button title="בחירה מהגלריה" variant="secondary" onPress={() => pick(false)} disabled={busy || photos.length >= 3} /></Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>{photos.map((photo, index) => <Pressable key={`${photo.uri}:${index}`} accessibilityRole="button" accessibilityLabel={`מחיקת תמונה ${index + 1}`} disabled={busy} onPress={() => { revision.current++; setPhotos(p => p.filter((_, i) => i !== index)); setObservations([]); setNotes(''); setDraft(null); }}><Image source={{ uri: photo.uri }} style={{ width: 88, height: 88, borderRadius: 10, marginVertical: 8 }} /><Text style={font.tiny}>מחיקת תמונה</Text></Pressable>)}</Row>
      {keyReady === false ? <ApiKeyPrompt description="זיהוי ציוד בחדר כושר משתמש באותו מפתח Gemini כמו זיהוי אוכל. אפשר להוסיף מפתח, או להמשיך עם בחירת ציוד ידנית." onSaved={() => setKeyReady(true)} /> : null}
      <Button title="זיהוי ציוד בתמונות" onPress={analyze} loading={busy} disabled={busy || !photos.length || !keyReady} />
      {busy ? <Button title="מעבר לבחירת ציוד ידנית" variant="ghost" onPress={() => { revision.current++; setBusy(false); setError(''); }} /> : null}
      {notes ? <Text style={font.small}>{notes}</Text> : null}
      {observations.map((o, i) => <Text key={`${o.equipment}:${i}`} style={font.tiny}>{EQUIPMENT[o.equipment]} · {o.confidence === 'high' ? 'זיהוי ברור' : 'דרוש אישור ידני'} · {o.evidence}</Text>)}
    </Card>
    <Card style={{ gap: 12 }}><Text style={font.h3}>3 · אישור הציוד והמקום</Text><Text style={font.small}>רק ציוד שסומן כאן ישמש באימון. בדקו במיוחד חיבורים בפולי וסוג מכונת הרגליים; תמונה אינה מאשרת את תקינותם.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(Object.keys(EQUIPMENT) as EquipmentKey[]).map(key => <Button key={key} title={EQUIPMENT[key]} size="sm" disabled={busy} variant={gym.equipment.includes(key) ? 'primary' : 'secondary'} onPress={() => changeGym({ ...gym, equipment: gym.equipment.includes(key) ? gym.equipment.filter(e => e !== key) : [...gym.equipment, key] })} />)}</View>
      <Text style={[font.h3, { marginTop: 14 }]}>מגבלות במקום</Text>
      {([{ key: 'smallSpace', label: 'מרחב קטן' }, { key: 'noFloor', label: 'אין אפשרות לשכב על הרצפה' }, { key: 'noOverhead', label: 'אין אפשרות לעבוד מעל הראש' }, { key: 'noJumping', label: 'ללא קפיצות' }] as const).map(option => <Button key={option.key} title={`${gym[option.key] ? '✓ ' : ''}${option.label}`} size="sm" disabled={busy} variant={gym[option.key] ? 'primary' : 'secondary'} onPress={() => changeGym({ ...gym, [option.key]: !gym[option.key] })} />)}
      <Button title="אישור הציוד ויצירת התאמה" onPress={preview} disabled={busy} />
    </Card>
    {error ? <Text style={[font.small, { color: colors.danger }]}>{error}</Text> : null}
    {draft ? <Card style={{ gap: 12 }}><Text style={font.h3}>4 · האימון המותאם</Text><Text style={font.small}>{draft.instructions}</Text>
      {draft.rows.map(row => { const ex = L.exercises.find(e => e.id === row.exerciseId), original = L.exercises.find(e => e.id === row.originalId); return <View key={row.exerciseId} style={{ borderTopWidth: 1, borderColor: colors.border, paddingVertical: 12 }}><Text style={font.h3}>{ex?.nameHe ?? ex?.name}</Text>{row.changed && original ? <Text style={font.tiny}>במקום {original.nameHe ?? original.name}</Text> : null}<Text style={font.small}>{row.item.sets.length} {kind === 'crossfit' ? 'סבבים' : 'סטים'} · {(ex?.tracking === 'cardio' ? row.item.sets[0]?.weight : row.item.sets[0]?.reps) || 'בחירה באימון'} {ex?.tracking === 'cardio' ? 'דקות' : 'חזרות'} · {ex?.tracking === 'cardio' ? 'קצב שמאפשר שיחה' : 'המשקל נבחר באימון'}</Text><Text style={font.tiny}>{row.reason}</Text></View>; })}
      {draft.omitted.length ? <View><Text style={[font.h3, { color: colors.warning }]}>מה לא ניתן לבצע כאן</Text>{draft.omitted.map((message, i) => <Text key={i} style={font.small}>{message}</Text>)}<Text style={font.tiny}>אלה לא ייחשבו כתרגילים שבוצעו ולא יתווספו אוטומטית כאימוני פיצוי.</Text></View> : null}
      <Button title="שמירת טיוטה" variant="secondary" disabled={saving || !draft.rows.length} onPress={() => save(false)} />
      <Button title={date === today() ? 'התחלת האימון המותאם' : 'אפשר להתחיל ביום השיבוץ'} disabled={saving || !draft.rows.length || date !== today()} loading={saving} onPress={() => save(true)} />
    </Card> : null}
    <Button title="חזרה ליומן" variant="ghost" onPress={() => router.replace({ pathname: '/train', params: { tab: 'journal' } })} />
  </Screen>;
}
