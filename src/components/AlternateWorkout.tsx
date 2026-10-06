import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { today } from '../lib/dates';
import { type TrainingKind, validDate, plannedSessions, completedSessions, matchSessions } from '../planning/model';
import { adaptationContext, type Area } from '../planning/adaptation';
import { updatePlanning, usePlanning } from '../planning/store';
import { L } from '../strength/store';
import { R } from '../run/store';
import { uid } from '../strength/utils';
import { font } from '../theme';
import { Sheet } from './sheet';
import { Button, Field, Segmented } from './ui';
export function AlternateWorkout({ date: initialDate, initialKind = 'crossfit', replacementId: initialReplacement, onClose }: { date: string; initialKind?: TrainingKind; replacementId?: string; onClose: () => void }) {
  const data = usePlanning(s => s.data);
  const [date, setDate] = useState(initialDate);
  const [kind, setKind] = useState<TrainingKind>(initialKind);
  const [title, setTitle] = useState('WOD קרוספיט');
  const [minutes, setMinutes] = useState('45');
  const [effort, setEffort] = useState('7');
  const [areas, setAreas] = useState<Area[]>(['legs', 'upper', 'core']);
  const [replacementId, setReplacementId] = useState<string | undefined>(initialReplacement);
  const [sourceId, setSourceId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const plans = plannedSessions(data, R.plans, date, date);
  const matches = matchSessions(plans, completedSessions(L.workouts, R.activities, data));
  const actual = completedSessions(L.workouts, R.activities).filter(a => a.date === date);
  async function save() {
    const m = Number(minutes), r = Number(effort);
    if (!validDate(date) || date > today() || !title.trim() || !Number.isFinite(m) || m <= 0 || m > 600 || !Number.isFinite(r) || r < 1 || r > 10 || !areas.length) return Alert.alert('בדקו את הפרטים', 'תאריך היום או בעבר, משך 1–600 דקות, עצימות 1–10 ואזור עומס אחד לפחות.');
    if (replacementId && !plans.some(p => p.id === replacementId && p.status !== 'skipped') || replacementId && matches.has(replacementId) && matches.get(replacementId) !== sourceId) return Alert.alert('השיבוץ השתנה', 'בחרו מחדש איזה אימון להחליף.');
    setBusy(true);
    try {
      const id = sourceId ?? `alternate:${uid()}`;
      await updatePlanning(d => ({ ...d, alternateWorkouts: [...(d.alternateWorkouts ?? []).filter(w => w.id !== id), { id, date, title: title.trim(), kind, minutes: m, effort: r, areas, replacementId }] }));
      onClose();
    } catch { Alert.alert('השמירה נכשלה', 'נסו שוב.'); } finally { setBusy(false); }
  }
  return <Sheet visible title="האימון שביצעתי בפועל" onClose={onClose}>
    <Text style={font.small}>אימון חדש, או עדכון עומס של אימון שכבר נשמר — בלי לרשום אותו פעמיים.</Text>
    <Button title="אימון חדש / WOD" variant={!sourceId ? 'primary' : 'secondary'} onPress={() => { setSourceId(undefined); setKind(initialKind); setTitle(initialKind === 'crossfit' ? 'WOD קרוספיט' : 'אימון ספונטני'); setReplacementId(initialReplacement); }} />
    {actual.map(a => <Button key={a.id} title={`עדכון: ${a.title}`} variant={sourceId === a.id ? 'primary' : 'secondary'} onPress={() => {
      setSourceId(a.id); setTitle(a.title); setKind(a.kind);
      const load = adaptationContext()?.loads.find(l => l.id === a.id);
      if (load) { setMinutes(String(Math.max(1, Math.round(load.minutes)))); setEffort(String(load.effort)); setAreas(load.areas); }
      setReplacementId(a.replacementId ?? data.alternateWorkouts?.find(w => w.id === a.id)?.replacementId);
    }} />)}
    <Segmented options={[{ value: 'strength', label: 'כוח' }, { value: 'run', label: 'ריצה / אירובי' }, { value: 'crossfit', label: 'קרוספיט' }]} value={kind} onChange={setKind} />
    <Field label="תאריך (YYYY-MM-DD)" value={date} onChangeText={v => { setDate(v); setReplacementId(undefined); setSourceId(undefined); }} />
    <Field label="שם האימון" value={title} onChangeText={setTitle} />
    <Field label="משך בדקות" value={minutes} keyboardType="numeric" onChangeText={setMinutes} />
    <Field label="עצימות מורגשת 1–10 (7 קשה, 10 מקסימלי)" value={effort} keyboardType="numeric" onChangeText={setEffort} />
    <Text style={font.small}>איפה היה העומס?</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['legs', 'upper', 'core'] as Area[]).map(a => <Button key={a} title={a === 'legs' ? 'רגליים / ריצה' : a === 'upper' ? 'פלג גוף עליון' : 'ליבה'} variant={areas.includes(a) ? 'primary' : 'secondary'} onPress={() => setAreas(v => v.includes(a) ? v.filter(x => x !== a) : [...v, a])} />)}</View>
    <Text style={font.small}>איזה אימון מתוכנן הוחלף?</Text>
    <Button title="אימון נוסף" variant={!replacementId ? 'primary' : 'secondary'} onPress={() => setReplacementId(undefined)} />
    {plans.filter(p => p.status !== 'skipped' && (!matches.has(p.id) || p.id === replacementId)).map(p => <Button key={p.id} title={p.title} variant={replacementId === p.id ? 'primary' : 'secondary'} onPress={() => setReplacementId(p.id)} />)}
    <Text style={font.tiny}>אימון שהוחלף לא יתווסף שוב בהמשך. ההתאמה לא מוסיפה אימונים לפיצוי על עבודה שלא בוצעה.</Text>
    <Button title="שמירה והתאמת התוכנית" loading={busy} disabled={busy} onPress={save} />
  </Sheet>;
}
