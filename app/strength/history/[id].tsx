// One finished workout with every set, ported from Lift's /history/:id view.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Menu, Sheet, toast } from '../../../src/components/sheet';
import { ExerciseThumb, SetBadge } from '../../../src/components/strength';
import { Button, Card, Row, Screen } from '../../../src/components/ui';
import {
  L,
  commitWorkout,
  deleteWorkout,
  exercise,
  exerciseName,
  fmtW,
  unitLabel,
  updateWorkout,
  useLiftVersion,
  workout,
  workoutSetCount,
  workoutVolume,
} from '../../../src/strength/store';
import { deepClone, epley1RM, fmtCompact, fmtDate, fmtDuration, fmtNum, fmtTime } from '../../../src/strength/utils';
import { canResume, resumeFinished } from '../../../src/strength/workout';
import { colors, font, spacing } from '../../../src/theme';

export default function WorkoutDetail() {
  useLiftVersion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const w = workout(id);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState<null | 'name' | 'note'>(null);
  const [draft, setDraft] = useState('');
  if (!w) return null;
  const prs = (w.prs || []).length;

  return (
    <Screen bottomInset={false}>
      <Stack.Screen
        options={{
          title: w.name,
          headerRight: () => (
            <Pressable onPress={() => setMenu(true)} hitSlop={10}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <Text style={[font.small, { marginBottom: spacing.md }]}>
        {fmtDate(w.startedAt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {fmtTime(w.startedAt)}
      </Text>
      <Card>
        <Row style={{ justifyContent: 'space-around' }}>
          <Mini k="זמן" v={fmtDuration(w.durationSec)} />
          <Mini k="נפח" v={`${fmtCompact(fmtW(workoutVolume(w)))} ${unitLabel()}`} />
          <Mini k="סטים" v={String(workoutSetCount(w))} />
          {prs ? <Mini k="שיאים" v={String(prs)} /> : null}
        </Row>
      </Card>
      {w.notes ? (
        <Card>
          <Text style={font.small}>{w.notes}</Text>
        </Card>
      ) : null}
      {w.items.map((it, i) => {
        const pr = (w.prs || []).find((p) => p.exerciseId === it.exerciseId);
        return (
          <Card key={i}>
            <Pressable onPress={() => router.push({ pathname: '/strength/exercise/[id]', params: { id: it.exerciseId } })}>
              <Row style={{ gap: spacing.sm, marginBottom: 6 }}>
                <ExerciseThumb ex={exercise(it.exerciseId)} size={32} />
                <Text style={[font.h3, { flex: 1, color: colors.primary }]}>{exerciseName(it.exerciseId)}</Text>
                {pr ? (
                  <Row style={{ gap: 3 }}>
                    <Ionicons name="trophy" size={13} color={colors.pr} />
                    <Text style={{ color: colors.pr, fontWeight: '700', fontSize: 12 }}>שיא</Text>
                  </Row>
                ) : null}
              </Row>
            </Pressable>
            {it.notes ? <Text style={[font.small, { marginBottom: 6 }]}>{it.notes}</Text> : null}
            <Row style={{ paddingVertical: 2 }}>
              <Text style={[font.tiny, { width: 40, textAlign: 'center' }]}>סט</Text>
              <Text style={[font.tiny, { flex: 1, textAlign: 'center' }]}>{unitLabel()}</Text>
              <Text style={[font.tiny, { flex: 1, textAlign: 'center' }]}>חזרות</Text>
              <Text style={[font.tiny, { flex: 1, textAlign: 'center' }]}>1RM</Text>
            </Row>
            {it.sets.map((s, si) => (
              <Row key={si} style={{ paddingVertical: 3 }}>
                <View style={{ width: 40, alignItems: 'center' }}>
                  <SetBadge sets={it.sets} index={si} />
                </View>
                <Text style={[font.body, { flex: 1, textAlign: 'center' }]}>{fmtNum(fmtW(s.weight))}</Text>
                <Text style={[font.body, { flex: 1, textAlign: 'center' }]}>{fmtNum(s.reps)}</Text>
                <Text style={[font.small, { flex: 1, textAlign: 'center' }]}>{s.type === 'warmup' ? '—' : fmtNum(fmtW(epley1RM(s.weight, s.reps)))}</Text>
              </Row>
            ))}
          </Card>
        );
      })}

      <Menu
        visible={menu}
        onClose={() => setMenu(false)}
        title={w.name}
        items={[
          canResume(w)
            ? {
                label: 'המשך האימון',
                icon: 'play',
                onPress: () => {
                  if (L.active) return Alert.alert('יש אימון פעיל', 'סיימו או בטלו אותו קודם.');
                  resumeFinished(w);
                  router.push('/strength/workout');
                },
              }
            : null,
          { label: 'שינוי שם', icon: 'create-outline', onPress: () => (setDraft(w.name), setEdit('name')) },
          { label: 'עריכת הערה', icon: 'document-text-outline', onPress: () => (setDraft(w.notes || ''), setEdit('note')) },
          {
            label: 'מחיקת האימון',
            icon: 'trash-outline',
            danger: true,
            onPress: () => {
              const copy = deepClone(w);
              deleteWorkout(w.id);
              router.back();
              toast('האימון נמחק', { action: { label: 'ביטול', onPress: () => commitWorkout(copy) } });
            },
          },
        ]}
      />
      <Sheet
        visible={!!edit}
        onClose={() => setEdit(null)}
        title={edit === 'name' ? 'שינוי שם' : 'הערה לאימון'}
        footer={
          <Button
            title="שמירה"
            onPress={() => {
              if (edit === 'name' && draft.trim()) w.name = draft.trim();
              if (edit === 'note') w.notes = draft.trim();
              updateWorkout(w);
              setEdit(null);
            }}
          />
        }
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoFocus
          multiline={edit === 'note'}
          placeholder={edit === 'note' ? 'איך היה?' : ''}
          placeholderTextColor={colors.faint}
          style={{ color: colors.text, backgroundColor: colors.elev2, borderRadius: 12, padding: 12, minHeight: edit === 'note' ? 80 : undefined, textAlign: 'right', textAlignVertical: 'top' }}
        />
      </Sheet>
    </Screen>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={font.h3}>{v}</Text>
      <Text style={font.tiny}>{k}</Text>
    </View>
  );
}
