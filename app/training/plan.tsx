import { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Row, Screen, Segmented, Title } from '../../src/components/ui';
import { addDays, today } from '../../src/lib/dates';
import { updatePlanning, usePlanning } from '../../src/planning/store';
import { L, saveRoutine } from '../../src/strength/store';
import { uid } from '../../src/strength/utils';
import { ADVANCED_DAY_NAMES, ADVANCED_ORDER, ADVANCED_SLOTS, DEFAULT_SLOTS, KIND_LABEL, RESEARCH, advancedItems, fullBodyItems, crossfitItems, validateProgram, type CombinedProgram } from '../../src/training/combined';
import { colors, font } from '../../src/theme';
const weekdays = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
export default function TrainingPlan() {
  const data = usePlanning(s => s.data);
  const router = useRouter();
  const [level, setLevel] = useState<CombinedProgram['level']>(data.combinedProgram?.level ?? 'returning');
  const [slots, setSlots] = useState([...data.combinedProgram?.slots ?? DEFAULT_SLOTS]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function activate() {
    const program: CombinedProgram = { enabled: true, startDate: today(), level, slots, routineIds: [] };
    const errors = validateProgram(program); if (errors.length) { setError(errors.join('\n')); return; }
    setBusy(true); setError('');
    try {
      const ids: string[] = [];
      const advanced = level === 'advanced';
      for (let i = 0; i < (advanced ? 3 : 2); i++) {
        const prior = L.routines.find(r => r.bundledKey === `life:hybrid:${level}:${i}`);
        const items = advanced ? advancedItems(L.exercises, i) : fullBodyItems(L.exercises, i, level);
        if (items.length < 4) throw new Error('ספריית התרגילים עדיין נטענת. חזרו למסך ונסו שוב.');
        ids.push(prior?.id ?? saveRoutine({
          name: advanced ? ADVANCED_DAY_NAMES[i] : `כוח משולב ${i === 0 ? 'A' : 'B'}`,
          bundledKey: `life:hybrid:${level}:${i}`, items,
          notes: advanced ? 'תוכנית למתאמן מנוסה בגירעון קלורי: משקלים כבדים בתרגילים המרכזיים, 1–2 חזרות ברזרבה. מאמן ההתקדמות מעלה משקל כשמגיעים לראש טווח החזרות.' : 'גוף מלא לשמירת שריר בזמן ירידה במשקל. משקלים נבחרים אישית; 2–3 חזרות ברזרבה.',
        }).id);
      }
      program.routineIds = ids;
      if (slots.includes('crossfit')) {
        const priorCrossfit = L.routines.find(r => r.bundledKey === `life:hybrid:crossfit:${level}`);
        program.crossfitRoutineId = priorCrossfit?.id ?? saveRoutine({ name: 'קרוספיט משולב · סבב טכני', bundledKey: `life:hybrid:crossfit:${level}`, items: crossfitItems(L.exercises, level === 'advanced' ? 'regular' : level), notes: 'סבב טכני מדורג. WOD של שיעור יכול להחליף אותו ביומן.' }).id;
      }
      await updatePlanning(d => {
        let strengthIndex = 0;
        const newRules = slots.flatMap((kind, weekday) => {
          if (kind === 'rest' || kind === 'run') return [];
          const routineId = kind === 'strength' ? ids[advanced ? ADVANCED_ORDER[strengthIndex++ % 3] : strengthIndex++ % ids.length] : program.crossfitRoutineId;
          return [{ id: `hybrid:${uid()}:${weekday}`, weekday, kind, title: kind === 'strength' ? L.routines.find(r => r.id === routineId)!.name : level === 'returning' ? 'קרוספיט · טכניקה וקצב נשלט' : 'קרוספיט · WOD מדורג', routineId, startDate: today(), plannedEffort: level === 'advanced' ? 8 : kind === 'crossfit' && level === 'regular' ? 7 : 6, minutes: kind === 'crossfit' ? level === 'returning' ? 30 : 45 : level === 'advanced' ? 65 : 45 }];
        });
        return { ...d, combinedProgram: program, programHistory: [...(d.programHistory ?? []), ...(d.combinedProgram ? [d.combinedProgram] : [])],
          rules: [...d.rules.map(r => r.id.startsWith('hybrid:') && (!r.endDate || r.endDate >= today()) ? { ...r, endDate: addDays(today(), -1) } : r), ...newRules] };
      });
      router.replace({ pathname: '/train', params: { tab: 'journal' } });
    } catch (e) { setError(e instanceof Error ? e.message : 'שמירת התוכנית נכשלה.'); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try { await updatePlanning(d => ({ ...d, combinedProgram: d.combinedProgram ? { ...d.combinedProgram, enabled: false, startDate: today() } : undefined,
      programHistory: [...(d.programHistory ?? []), ...(d.combinedProgram ? [d.combinedProgram] : [])], rules: d.rules.map(r => r.id.startsWith('hybrid:') && (!r.endDate || r.endDate >= today()) ? { ...r, endDate: addDays(today(), -1) } : r) })); }
    catch { Alert.alert('השמירה נכשלה'); } finally { setBusy(false); }
  }
  return <Screen><Title sub="כוח + ריצה + קרוספיט">תוכנית משולבת לירידה במשקל</Title>
    <Card style={{ gap: 12 }}><Text style={font.h3}>{level === 'advanced' ? 'למתאמן מנוסה: 3 כוח · 2 ריצות · 2 מנוחה' : 'נקודת פתיחה: 2 כוח · 2 ריצות קלות · 1 קרוספיט'}</Text><Text style={font.small}>אימוני כוח שומרים על השריר. ריצה קלה מוסיפה נפח אירובי שאפשר להתמיד בו. הקרוספיט מספק את היום העצימתי; אין צורך להוסיף גם אינטרוולים בריצה. יום קרוספיט קבוע נשאר ביום שבחרת; בעת עומס מומלץ להקל את השיעור או לבחור מנוחה. בחלוקה הזאת יש יום קל או מנוחה בין הימים העמוסים.</Text></Card>
    <Segmented options={[{ value: 'returning', label: 'חוזר לשגרה' }, { value: 'regular', label: 'בקביעות' }, { value: 'advanced', label: 'מנוסה' }]} value={level} onChange={(v) => { setLevel(v); if (v === 'advanced' && slots.join() === DEFAULT_SLOTS.join()) setSlots([...ADVANCED_SLOTS]); if (v !== 'advanced' && slots.join() === ADVANCED_SLOTS.join()) setSlots([...DEFAULT_SLOTS]); }} />
    <Text style={font.small}>{level === 'advanced' ? 'כוח: 3 אימונים (תחתון / עליון / גוף מלא), 3–4 סטים, 4–8 חזרות בתרגילים המרכזיים. ריצה: אימון איכות + ריצה ארוכה קלה, בקצבים לפי הכושר שלך. קרוספיט לא חובה.' : level === 'returning' ? 'כוח: שני סטים לתרגיל. ריצה/הליכה: 25 דקות. קרוספיט: 30 דקות בדגש על טכניקה; לא WOD מקסימלי.' : 'כוח: 2–3 סטים לתרגיל. ריצות קלות: 35 דקות. קרוספיט: עד 45 דקות, עצימות נשלטת.'}</Text>
    {weekdays.map((day, index) => <Card key={day} style={{ gap: 12 }}><Text style={font.h3}>{day}</Text><Row style={{ gap: 6, flexWrap: 'wrap' }}>{(['strength','run','crossfit','rest'] as const).map(kind => <Button key={kind} size="sm" title={kind === 'rest' ? 'מנוחה' : KIND_LABEL[kind]} variant={slots[index] === kind ? 'primary' : 'secondary'} onPress={() => setSlots(v => v.map((s, i) => i === index ? kind : s))} />)}</Row></Card>)}
    <Card style={{ gap: 12 }}><Text style={font.h3}>נפח, תזונה והתקדמות</Text><Text style={font.small}>המטרה ארוכת הטווח היא לפחות 150 דקות אירוביות מתונות בשבוע, וניתן להתקדם לכיוון 300 לפי יכולת. הריצות כאן הן חלק מהנפח; הוסיפו בהדרגה הליכה נמרצת. בתחילת הדרך אין צורך להגיע מיד ליעד המלא. לא נחשב את כל זמן שיעור הקרוספיט כאירובי.</Text><Text style={font.small}>הירידה במשקל תלויה גם בגירעון קלורי ובהתמדה בתזונה. אימון ספונטני מחליף אימון קיים; הוא אינו מוסיף אוטומטית עוד אימון או קלוריות אכילה.</Text></Card>
    <Card style={{ gap: 12 }}><Text style={font.h3}>מה יקרה לשיבוצים שכבר קיימים?</Text><Text style={font.small}>החלוקה החדשה תתאם את ימי הריצה של המאמן ותיצור רוטינות כוח נפרדות. שיבוצים ידניים ומרוצים נשמרים ומוצגים כדי שלא יימחקו בשקט. אפשר לבטל אותם ביומן אם הם כפולים. משקלים לא מועתקים מרוטינה של אדם אחר.</Text></Card>
    {error ? <Text style={[font.small, { color: colors.danger }]}>{error}</Text> : null}
    <Button title="שמירה והפעלת החלוקה הזאת" onPress={activate} loading={busy} disabled={busy} />
    {data.combinedProgram?.enabled ? <Button title="כיבוי החלוקה המשולבת" disabled={busy} variant="ghost" onPress={disable} /> : null}
    <Card style={{ gap: 12 }}><Text style={font.h3}>המחקר שעליו נשען התכנון</Text><Text style={font.small}>השילוב והמינון הם בחירת תכנון מעשית, לא פרוטוקול יחיד שנבדק בדיוק כך. ההתאמה לציוד אינה יכולה לקבוע משקלים או מגבלות גופניות מתמונה.</Text>{RESEARCH.map(r => <Button key={r.url} title={r.title} size="sm" variant="ghost" onPress={() => Linking.openURL(r.url)} />)}</Card>
  </Screen>;
}
