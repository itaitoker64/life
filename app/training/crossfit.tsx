import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useState } from 'react';
import { useStartWorkout } from '../../src/components/strengthCards';
import { startFromRoutine } from '../../src/strength/workout';
import { AlternateWorkout } from '../../src/components/AlternateWorkout';
import { Button, Card, Screen, Title } from '../../src/components/ui';
import { plannedSessions, validDate } from '../../src/planning/model';
import { usePlanning } from '../../src/planning/store';
import { today } from '../../src/lib/dates';
import { R } from '../../src/run/store';
import { L } from '../../src/strength/store';
import { font } from '../../src/theme';
export default function Crossfit() {
  const params = useLocalSearchParams<{ date?: string; sessionId?: string }>();
  const date = params.date && validDate(params.date) ? params.date : today();
  const data = usePlanning(s => s.data), router = useRouter();
  const [logging, setLogging] = useState(false);
  const startWorkout = useStartWorkout();
  const plan = plannedSessions(data, R.plans, date, date).find(p => p.id === params.sessionId || !params.sessionId && p.kind === 'crossfit');
  const routine = L.routines.find(r => r.id === plan?.routineId);
  return <Screen><Title sub={date}>{plan?.title ?? 'קרוספיט'}</Title>
    <Card style={{ gap: 12 }}><Text style={font.h3}>קרוספיט כחלק מהשבוע</Text><Text style={font.small}>חימום 5–8 דקות, עבודה בקצב שמאפשר לשמור על הטכניקה, ומנוחה לפי הצורך. ברמת מתחיל בחרו שיעור טכני או סבב מתון. WOD של שיעור יכול להחליף את הסבב המתוכנן; הזינו אחריו את העצימות והאזורים שעבדו.</Text>{plan?.adjustment ? <Text style={font.small}>{plan.adjustment.reason}</Text> : null}</Card>
    {routine ? <Card style={{ gap: 12 }}><Text style={font.h3}>הסבב המתוכנן</Text>{routine.items.map(item => { const ex = L.exercises.find(e => e.id === item.exerciseId); return <Text key={item.exerciseId} style={font.body}>{ex?.nameHe ?? ex?.name} · {item.sets.length} סבבים · {ex?.tracking === 'cardio' ? item.sets[0]?.weight : item.sets[0]?.reps} {ex?.tracking === 'cardio' ? 'דקות' : 'חזרות'}</Text>; })}<Text style={font.tiny}>אם בחרת שיעור או WOD אחר, רשום אותו במקום להוסיף אימון נוסף לאותו יום.</Text></Card> : null}
    {routine ? <Button title="התחלת הסבב המתוכנן" disabled={date !== today()} onPress={() => startWorkout(() => startFromRoutine(routine.id))} /> : null}
    <Button title="התאמה לציוד במקום הזה" onPress={() => router.push({ pathname: '/training/spontaneous', params: { date, ...(plan ? { sessionId: plan.id } : {}) } })} />
    <Button title="רישום WOD שבוצע בפועל" variant="secondary" disabled={date > today()} onPress={() => setLogging(true)} />
    {logging ? <AlternateWorkout date={date} initialKind="crossfit" replacementId={plan?.id} onClose={() => setLogging(false)} /> : null}
  </Screen>;
}
