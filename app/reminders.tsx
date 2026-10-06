import { useState } from 'react';
import { Alert, Linking, Platform, Switch, Text, View } from 'react-native';
import { Button, Card, Field, Row, Screen, Title } from '../src/components/ui';
import { toast } from '../src/components/sheet';
import { validTime } from '../src/planning/model';
import { requestReminderPermission, syncReminders } from '../src/planning/reminders';
import { updatePlanning, usePlanning } from '../src/planning/store';
import { colors, font } from '../src/theme';

export default function Reminders() {
  const { data, ready } = usePlanning();
  const [workout, setWorkout] = useState(data.reminders.workoutEnabled);
  const [meals, setMeals] = useState(data.reminders.mealsEnabled);
  const [time, setTime] = useState(data.reminders.workoutTime);
  const [mealTimes, setMealTimes] = useState(data.reminders.mealTimes.join(', '));
  const [busy, setBusy] = useState(false);
  async function save() {
    const times = mealTimes.split(',').map(t => t.trim()).filter(Boolean);
    if ((workout && !validTime(time)) || (meals && (times.length < 1 || times.length > 3 || !times.every(validTime)))) return Alert.alert('שעות לא תקינות', 'השתמשו בפורמט HH:MM. אפשר לבחור עד שלוש שעות לתזכורות תזונה, מופרדות בפסיק.');
    setBusy(true);
    try {
      if ((workout || meals) && !(await requestReminderPermission())) {
        Alert.alert('נדרשת הרשאת התראות', 'אפשר לאפשר התראות ל־Life בהגדרות הטלפון.', [{ text: 'סגירה' }, { text: 'פתיחת הגדרות', onPress: () => Linking.openSettings() }]);
        return;
      }
      await updatePlanning(d => ({ ...d, reminders: { workoutEnabled: workout, workoutTime: validTime(time) ? time : d.reminders.workoutTime, mealsEnabled: meals, mealTimes: times.filter(validTime).slice(0, 3) } }));
      await syncReminders();
      toast('התזכורות נשמרו');
    } catch { Alert.alert('התזכורות לא עודכנו', 'בדקו הרשאת התראות ונסו לשמור שוב.'); }
    finally { setBusy(false); }
  }
  return <Screen bottomInset={false}>
    <Title sub="בשעות שתבחרו, לפי שעון הטלפון">תזכורות</Title>
    <Card>
      <Row style={{ justifyContent: 'space-between' }}><Text style={font.h3}>תזכורת לאימון</Text><Switch accessibilityLabel="תזכורות לאימונים" value={workout} onValueChange={setWorkout} trackColor={{ true: colors.primary }} /></Row>
      <Field label="שעת התזכורת (HH:MM)" value={time} onChangeText={setTime} maxLength={5} style={{ writingDirection: 'ltr' }} />
      <Text style={font.small}>תזכורת אחת ביום עם האימונים שטרם בוצעו. התכנון לארבעת השבועות הבאים מתעדכן בכל פתיחה של האפליקציה ובכל שינוי בתוכנית.</Text>
    </Card>
    <Card>
      <Row style={{ justifyContent: 'space-between' }}><Text style={font.h3}>רישום ארוחות</Text><Switch accessibilityLabel="תזכורות לרישום ארוחות" value={meals} onValueChange={setMeals} trackColor={{ true: colors.primary }} /></Row>
      <Field label="עד 3 שעות, מופרדות בפסיק" value={mealTimes} onChangeText={setMealTimes} placeholder="08:00, 13:00, 20:00" style={{ writingDirection: 'ltr' }} />
      <Text style={font.small}>תזכורות יומיות קבועות לרישום מזון, גם כשהאפליקציה סגורה.</Text>
    </Card>
    {Platform.OS === 'web' ? <Text style={[font.small, { marginBottom: 12 }]}>תזכורות זמינות באפליקציה בטלפון.</Text> : null}
    <Button title="שמירת תזכורות" loading={busy} disabled={busy || !ready || Platform.OS === 'web'} onPress={save} />
    <View style={{ height: 12 }} /><Button title="הרשאות התראות בטלפון" variant="ghost" onPress={() => Linking.openSettings()} />
  </Screen>;
}
