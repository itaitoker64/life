import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { toast } from '../src/components/sheet';
import { Button, Card, Field, Screen, SectionTitle } from '../src/components/ui';
import { exportSnapshot, importSnapshot, snapshotSummary, type Snapshot } from '../src/lib/backup';
import { backupNow, cloudBackupInfo, restoreFromCloud, signIn, signOut, signUp, supabase, useCloud } from '../src/lib/cloud';
import { initRun } from '../src/run/store';
import { initPlanning } from '../src/planning/store';
import { useApp } from '../src/state/store';
import { importLift, initLift } from '../src/strength/store';
import { colors, font, spacing } from '../src/theme';

function when(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function Backup() {
  const { init } = useApp();
  const { session, lastBackup, busy } = useCloud();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudInfo, setCloudInfo] = useState<{ updated_at: string; size_bytes: number | null } | null>(null);

  useEffect(() => {
    if (session) cloudBackupInfo().then(setCloudInfo).catch(() => {});
  }, [session, lastBackup]);

  async function reloadAll() {
    await init();
    await Promise.all([initLift(), initRun()]);
    await initPlanning();
  }

  async function auth(kind: 'in' | 'up') {
    if (!email.trim() || password.length < 6) {
      toast('אימייל וסיסמה של 6 תווים לפחות');
      return;
    }
    setAuthBusy(true);
    try {
      if (kind === 'up') {
        const r = await signUp(email, password);
        if (r === 'confirm') {
          Alert.alert('נשלח מייל אישור', 'פתחו את המייל מ-Supabase ולחצו על הקישור (גם אם הדף שנפתח לא נטען — האישור נקלט). אחר כך חזרו לכאן ולחצו "התחברות".');
          return;
        }
      } else {
        await signIn(email, password);
      }
      setPassword('');
      const info = await cloudBackupInfo().catch(() => null);
      if (info) {
        Alert.alert('נמצא גיבוי בענן', `מ-${when(info.updated_at)}. לשחזר אותו לטלפון הזה? (זה מחליף את הנתונים הנוכחיים)`, [
          { text: 'לא, לגבות את הטלפון הזה', onPress: () => backupNow().then(() => toast('גובה לענן')).catch((e) => Alert.alert('הגיבוי נכשל', String(e?.message ?? e))) },
          { text: 'לשחזר', style: 'destructive', onPress: restore },
        ]);
      } else {
        await backupNow();
        toast('מחובר — הגיבוי הראשון נשמר בענן');
      }
    } catch (e) {
      Alert.alert('ההתחברות נכשלה', e instanceof Error ? e.message : String(e));
    } finally {
      setAuthBusy(false);
    }
  }

  async function restore() {
    try {
      await restoreFromCloud();
      await reloadAll();
      toast('השחזור הושלם');
    } catch (e) {
      Alert.alert('השחזור נכשל', e instanceof Error ? e.message : String(e));
    }
  }

  async function exportFile() {
    try {
      const snap = await exportSnapshot();
      const f = new File(Paths.cache, `life-backup-${new Date().toISOString().slice(0, 10)}.json`);
      if (f.exists) f.delete();
      f.create();
      f.write(JSON.stringify(snap));
      await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'שמירת קובץ הגיבוי' });
    } catch (e) {
      Alert.alert('הייצוא נכשל', e instanceof Error ? e.message : String(e));
    }
  }

  async function importFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    let obj: any;
    try {
      obj = JSON.parse(await new File(res.assets[0].uri).text());
    } catch {
      Alert.alert('קובץ לא תקין', 'לא הצלחתי לקרוא את הקובץ כ-JSON.');
      return;
    }
    if (obj?.app === 'lift') {
      Alert.alert('גיבוי של Lift', `${obj.data?.workouts?.length ?? 0} אימונים, ${obj.data?.routines?.length ?? 0} רוטינות. להוסיף ל-Life?`, [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'להוסיף',
          onPress: async () => {
            try {
              const c = await importLift(obj, 'merge');
              toast(`יובאו ${c.workouts} אימונים ו-${c.routines} רוטינות`);
            } catch (e) {
              Alert.alert('הייבוא נכשל', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]);
      return;
    }
    if (obj?.app === 'life') {
      const s = snapshotSummary(obj as Snapshot);
      Alert.alert(
        'שחזור מקובץ',
        `גיבוי מ-${when(obj.exportedAt)}: ${s.foodLog} רישומי אוכל, ${s.weights} שקילות, ${s.workouts} אימונים, ${s.runs} ריצות.\nזה מחליף את כל הנתונים בטלפון.`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'לשחזר',
            style: 'destructive',
            onPress: async () => {
              try {
                await importSnapshot(obj);
                await reloadAll();
                toast('השחזור הושלם');
              } catch (e) {
                Alert.alert('השחזור נכשל', e instanceof Error ? e.message : String(e));
              }
            },
          },
        ],
      );
      return;
    }
    Alert.alert('קובץ לא מוכר', 'אפשר לייבא גיבוי של Life או קובץ ייצוא של Lift.');
  }

  return (
    <Screen bottomInset={false}>
      <SectionTitle>גיבוי לענן</SectionTitle>
      <Card>
        {!supabase ? (
          <Text style={font.small}>הענן לא מוגדר בגרסה הזו.</Text>
        ) : session ? (
          <>
            <Text style={[font.body, { fontWeight: '700' }]}>מחובר: {session.user.email}</Text>
            <Text style={[font.small, { marginTop: 4, marginBottom: spacing.md }]}>
              גיבוי אחרון בענן: {when(cloudInfo?.updated_at ?? lastBackup)}
              {cloudInfo?.size_bytes ? ` · ${Math.round(cloudInfo.size_bytes / 1024)}KB` : ''}
              {'\n'}הגיבוי רץ אוטומטית כשיוצאים מהאפליקציה (לכל היותר פעם ב-15 דקות).
            </Text>
            <Button title="גיבוי עכשיו" loading={busy} onPress={() => backupNow().then(() => toast('גובה לענן')).catch((e) => Alert.alert('הגיבוי נכשל', String(e?.message ?? e)))} />
            <Button
              title="שחזור מהענן"
              variant="secondary"
              style={{ marginTop: spacing.sm }}
              onPress={() =>
                Alert.alert('לשחזר מהענן?', 'זה מחליף את כל הנתונים בטלפון בגיבוי האחרון.', [
                  { text: 'ביטול', style: 'cancel' },
                  { text: 'לשחזר', style: 'destructive', onPress: restore },
                ])
              }
            />
            <Button title="התנתקות" variant="ghost" style={{ marginTop: spacing.sm }} onPress={signOut} />
          </>
        ) : (
          <>
            <Text style={[font.small, { marginBottom: spacing.md, lineHeight: 19 }]}>
              חשבון בפרויקט Supabase שלך. אחרי ההתחברות כל הנתונים (תזונה, אימונים, ריצות) מגובים אוטומטית, ובטלפון חדש מתחברים ומשחזרים.
            </Text>
            <Field label="אימייל" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
            <Field label="סיסמה" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <Button title="התחברות" loading={authBusy} onPress={() => auth('in')} />
            <Button title="הרשמה (פעם ראשונה)" variant="secondary" style={{ marginTop: spacing.sm }} onPress={() => auth('up')} disabled={authBusy} />
          </>
        )}
      </Card>

      <SectionTitle>קובץ גיבוי</SectionTitle>
      <Card>
        <Text style={[font.small, { marginBottom: spacing.md }]}>שמירה של כל הנתונים לקובץ (למשל ל-Google Drive), או שחזור מקובץ.</Text>
        <Button title="ייצוא לקובץ" variant="secondary" onPress={exportFile} />
        <Button title="ייבוא מקובץ" variant="secondary" style={{ marginTop: spacing.sm }} onPress={importFile} />
        <Text style={[font.tiny, { marginTop: spacing.sm, color: colors.faint }]}>ייבוא מקבל גם קובץ ייצוא של Lift (הגדרות ← Export באתר הישן) — האימונים נוספים לקיימים.</Text>
      </Card>
    </Screen>
  );
}
