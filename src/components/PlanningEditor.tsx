import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { addDays, today } from '../lib/dates';
import { type Session, type TrainingKind, validDate } from '../planning/model';
import { updatePlanning, usePlanning } from '../planning/store';
import { L, routines } from '../strength/store';
import { uid } from '../strength/utils';
import { font } from '../theme';
import { Menu, Sheet, toast } from './sheet';
import { Button, Card, DateStepper, Field, Row, Segmented } from './ui';

const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export function PlanningEditor({ date, onClose }: { date: string; onClose: () => void }) {
  const data = usePlanning(s => s.data);
  const [mode, setMode] = useState<'once' | 'weekly'>('weekly');
  const [kind, setKind] = useState<TrainingKind>('strength');
  const [weekday, setWeekday] = useState('0');
  const [routineId, setRoutineId] = useState(routines()[0]?.id ?? '');
  const [title, setTitle] = useState('ריצה');
  const [picker, setPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date);
  const [busy, setBusy] = useState(false);
  const routine = L.routines.find(r => r.id === routineId);
  async function save() {
    if (!validDate(selectedDate) || selectedDate < today()) return Alert.alert('תאריך לא תקין', 'בחרו היום או תאריך עתידי.');
    if (kind === 'strength' && !routine) return Alert.alert('בחרו רוטינה', 'צרו רוטינה בלשונית כוח ואז שובו לתכנון.');
    if (kind !== 'strength' && !title.trim()) return Alert.alert('חסר שם', 'הוסיפו שם לאימון.');
    setBusy(true);
    try {
      const base = { id: uid(), kind, title: kind === 'strength' ? routine!.name : title.trim(), routineId: kind === 'strength' ? routineId : undefined, plannedEffort: kind === 'crossfit' ? 7 : undefined };
      await updatePlanning(d => mode === 'weekly'
        ? { ...d, rules: [...d.rules, { ...base, weekday: Number(weekday), startDate: selectedDate }] }
        : { ...d, sessions: [...d.sessions, { ...base, date: selectedDate }] });
      toast(mode === 'weekly' ? 'האימון נוסף לתכנון השבועי' : 'האימון שובץ ביומן');
      onClose();
    } catch { Alert.alert('השמירה נכשלה', 'נסו שוב.'); }
    finally { setBusy(false); }
  }
  async function stopRule(id: string) {
    setBusy(true);
    try {
      await updatePlanning(d => ({ ...d,
        rules: d.rules.map(r => r.id === id ? { ...r, endDate: addDays(today(), -1) } : r),
        overrides: d.overrides.map(o => o.id.startsWith(`weekly:${id}:`) && o.date >= today() ? { ...o, cancelled: true } : o),
      }));
      toast('האימונים העתידיים בסדרה בוטלו');
    } catch { Alert.alert('השמירה נכשלה', 'נסו שוב.'); }
    finally { setBusy(false); }
  }
  return <Sheet visible onClose={onClose} title="תכנון אימונים">
    <Segmented options={[{ value: 'weekly', label: 'כל שבוע' }, { value: 'once', label: 'חד־פעמי' }]} value={mode} onChange={setMode} />
    <Segmented options={[{ value: 'strength', label: 'כוח' }, { value: 'run', label: 'ריצה' }, { value: 'crossfit', label: 'קרוספיט' }]} value={kind} onChange={value => { setKind(value); if (title === 'ריצה' || title === 'קרוספיט') setTitle(value === 'crossfit' ? 'קרוספיט' : 'ריצה'); }} />
    {mode === 'weekly' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>{weekdays.map((day, i) => <Button key={day} title={day} size="sm" variant={weekday === String(i) ? 'primary' : 'secondary'} onPress={() => setWeekday(String(i))} />)}</View> : null}
    {kind === 'strength' ? <Button title={routine?.name ?? 'בחירת רוטינה'} variant="secondary" onPress={() => setPicker(true)} /> : <Field label="שם האימון" value={title} onChangeText={setTitle} />}
    <DateStepper label={mode === 'weekly' ? 'החל מתאריך' : 'תאריך'} value={selectedDate} min={today()} onChange={setSelectedDate} />
    {kind === 'run' ? <Text style={[font.tiny, { marginBottom: 12 }]}>אם קיימת תוכנית ריצה מפורטת לאותו יום, היא תופיע במקום הריצה הקבועה.</Text> : null}
    <Button title="שמירת אימון" loading={busy} disabled={busy} onPress={save} />
    <Text style={[font.h3, { marginVertical: 14 }]}>החלוקה השבועית שלי</Text>
    {data.rules.filter(r => !r.endDate || r.endDate >= today()).map(r => <Card key={r.id}>
      <Row style={{ justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={font.body}>{weekdays[r.weekday]} · {r.title}</Text><Text style={font.tiny}>{r.kind === 'strength' ? 'כוח' : r.kind === 'crossfit' ? 'קרוספיט' : 'ריצה'} · החל מ־{r.startDate}</Text></View><Button title="ביטול הסדרה" size="sm" variant="danger" disabled={busy} onPress={() => stopRule(r.id)} /></Row>
    </Card>)}
    <Text style={font.tiny}>ביטול סדרה חל מהיום. ההיסטוריה נשמרת. אפשר להזיז או לבטל אימון בודד מתוך היומן.</Text>
    <Menu visible={picker} onClose={() => setPicker(false)} title="בחירת רוטינה" items={routines().map(r => ({ label: r.name, onPress: () => setRoutineId(r.id) }))} />
  </Sheet>;
}

export function MoveSession({ session, onClose }: { session: Session; onClose: () => void }) {
  const [date, setDate] = useState(session.date);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!validDate(date) || date < today()) return Alert.alert('תאריך לא תקין', 'בחרו היום או תאריך עתידי.');
    setBusy(true);
    try {
      await updatePlanning(d => {
        const old = d.overrides.find(o => o.id === session.id);
        return { ...d, overrides: [...d.overrides.filter(o => o.id !== session.id), { id: session.id, originalDate: old?.originalDate ?? session.date, date }] };
      });
      toast('האימון הועבר'); onClose();
    } catch { Alert.alert('ההעברה נכשלה', 'נסו שוב.'); }
    finally { setBusy(false); }
  }
  return <Sheet visible onClose={onClose} title={`העברת ${session.title}`}>
    <DateStepper label="תאריך חדש" value={date} min={today()} onChange={setDate} />
    <Text style={[font.small, { marginBottom: 12 }]}>השינוי חל על האימון הזה בלבד.</Text>
    <Button title="העברת האימון" disabled={busy} loading={busy} onPress={save} />
  </Sheet>;
}
