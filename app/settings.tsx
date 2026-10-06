import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { toast } from '../src/components/sheet';
import { Stepper } from '../src/components/strength';
import { Button, Card, Divider, Field, ListRow, Screen, SectionTitle, Segmented, parseNum } from '../src/components/ui';
import { getDb } from '../src/db';
import { clearCollection } from '../src/db/docs';
import { aiUsageSummary } from '../src/db/usage';
import { applyTargets, updateExpenditureIfNeeded } from '../src/lib/coach';
import {
  clearApiKey,
  clearIntervalsCreds,
  getApiKey,
  getIntervalsCreds,
  setApiKey,
  setIntervalsCreds,
} from '../src/lib/secrets';
import type { ActivityLevel, Sex } from '../src/lib/tdee';
import type { Units } from '../src/lib/units';
import { R, initRun, syncIntervals, updateRunProfile, useRunVersion } from '../src/run/store';
import { initPlanning } from '../src/planning/store';
import { useApp } from '../src/state/store';
import { L, setSettings, useLiftVersion, wipeLift } from '../src/strength/store';
import { fmtClock } from '../src/strength/utils';
import { weeklyGoal } from '../src/strength/workout';
import { colors, font, spacing } from '../src/theme';

export default function Settings() {
  const { profile, patchProfile, refreshProfile, init } = useApp();
  const router = useRouter();
  useLiftVersion();
  useRunVersion();
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [icuKey, setIcuKey] = useState('');
  const [icuAthlete, setIcuAthlete] = useState('');
  const [hasIcu, setHasIcu] = useState(false);
  const [icuBusy, setIcuBusy] = useState(false);
  const [height, setHeight] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [hrMax, setHrMax] = useState(String(R.profile.hr_max));
  const [hrRest, setHrRest] = useState(String(R.profile.hr_rest));
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof aiUsageSummary>> | null>(null);

  useFocusEffect(
    useCallback(() => {
      getApiKey().then((k) => setHasKey(!!k));
      getIntervalsCreds().then((c) => {
        setHasIcu(!!c);
        if (c) setIcuAthlete(c.athleteId);
      });
      aiUsageSummary().then(setUsage);
    }, []),
  );

  useEffect(() => {
    if (!profile) return;
    setHeight(String(Math.round(profile.height_cm)));
    setBirthYear(String(profile.birth_year));
  }, [profile?.height_cm, profile?.birth_year]);

  if (!profile) return null;

  async function saveKey() {
    const k = key.trim();
    if (k.length < 20) {
      Alert.alert('מפתח לא תקין', 'העתיקו את המפתח במלואו מ-Google AI Studio.');
      return;
    }
    await setApiKey(k);
    const stored = await getApiKey();
    setKey('');
    setHasKey(!!stored);
    toast(stored ? 'המפתח נשמר בטלפון' : 'לא הצלחתי לשמור את המפתח');
  }

  async function saveIcu() {
    if (!icuKey.trim()) return;
    setIcuBusy(true);
    try {
      await setIntervalsCreds(icuKey, icuAthlete || '0');
      setIcuKey('');
      setHasIcu(true);
      const r = await syncIntervals({ fullHistory: true });
      toast(`מחובר! סונכרנו ${r.upserted} ריצות`);
    } catch (e) {
      Alert.alert('החיבור נכשל', e instanceof Error ? e.message : String(e));
    } finally {
      setIcuBusy(false);
    }
  }

  async function removeIcu() {
    await clearIntervalsCreds();
    setHasIcu(false);
  }

  async function saveBody() {
    const h = parseNum(height);
    const y = parseNum(birthYear);
    await patchProfile({ height_cm: h ?? profile!.height_cm, birth_year: y ?? profile!.birth_year });
    await applyTargets();
    await refreshProfile();
    toast('נשמר');
  }

  function saveHr() {
    const mx = parseNum(hrMax);
    const rs = parseNum(hrRest);
    if (!mx || !rs || mx < 120 || mx > 230 || rs < 30 || rs > 100) {
      Alert.alert('ערכים לא תקינים', 'דופק מקסימלי 120–230, דופק מנוחה 30–100.');
      return;
    }
    updateRunProfile({ hr_max: Math.round(mx), hr_rest: Math.round(rs) });
    toast('נשמר');
  }

  function resetAll() {
    Alert.alert('מחיקת כל הנתונים', 'זה מוחק את יומן האכילה, השקילות, המזונות שיצרת, האימונים, הריצות וההגדרות. אי אפשר לבטל.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'למחוק הכול',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await db.execAsync(`
            DELETE FROM food_log; DELETE FROM weight_entries; DELETE FROM expenditure_history;
            DELETE FROM foods WHERE source NOT IN ('moh'); DELETE FROM settings;
            UPDATE profile SET onboarded = 0, program_start = NULL, last_checkin = NULL, last_expenditure_update = NULL WHERE id = 1;
          `);
          for (const c of ['run_activities', 'run_plans', 'run_assessments', 'run_races', 'run_meta']) await clearCollection(c);
          await wipeLift();
          await initRun();
          await clearCollection('life_planning');
          await initPlanning();
          await init();
        },
      },
    ]);
  }

  return (
    <Screen bottomInset={false}>
      <Card style={{ padding: 0 }}>
        <ListRow icon="notifications-outline" title="תזכורות אימונים ותזונה" sub="בחירת שעות והרשאות התראות" onPress={() => router.push('/reminders')} />
        <ListRow icon="cloud-upload-outline" iconColor={colors.primary} title="גיבוי ושחזור" sub="גיבוי לענן, ייבוא מ-Lift ומ-Stride, קובץ גיבוי" onPress={() => router.push('/backup')} />
        <ListRow icon="scale-outline" iconColor={colors.weight} title="מגמת משקל" sub="מגמה, שינויים ותחזית" onPress={() => router.push('/weight')} />
        <ListRow icon="flame-outline" iconColor={colors.expenditure} title="הוצאה קלורית" sub="היסטוריית ההוצאה היומית" onPress={() => router.push('/expenditure')} last />
      </Card>

      <SectionTitle>מפתח Gemini (AI)</SectionTitle>
      <Card>
        <Text style={[font.small, { marginBottom: spacing.md, lineHeight: 19 }]}>
          משמש לזיהוי אוכל מתמונה, לקריאת תוויות ולניסוח הערות מאמן הריצה. המפתח חינמי ונשמר מוצפן בטלפון בלבד.{' '}
          {hasKey ? 'יש מפתח שמור.' : 'עוד לא נשמר מפתח.'}
        </Text>
        <Field placeholder="AIza..." value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry />
        <Button title={hasKey ? 'החלפת המפתח' : 'שמירת המפתח'} onPress={saveKey} disabled={!key.trim()} />
        {hasKey ? (
          <Button title="הסרת המפתח" variant="ghost" onPress={async () => (await clearApiKey(), setHasKey(false))} style={{ marginTop: spacing.sm }} />
        ) : (
          <Button title="יצירת מפתח ב-Google AI Studio" variant="ghost" onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} style={{ marginTop: spacing.sm }} />
        )}
        {usage && usage.all.calls > 0 ? (
          <Text style={[font.tiny, { marginTop: spacing.sm }]}>
            החודש: {usage.month.photos} תמונות · {usage.month.labels} תוויות · {((usage.month.input + usage.month.output) / 1000).toFixed(1)}k טוקנים
          </Text>
        ) : null}
      </Card>

      <SectionTitle>ריצה — intervals.icu</SectionTitle>
      <Card>
        <Text style={[font.small, { marginBottom: spacing.md, lineHeight: 19 }]}>
          הריצות מגיעות מ-Garmin דרך intervals.icu (חינמי). חברו שם את Garmin, ואז ב-Settings → Developer Settings העתיקו את ה-API key ואת
          ה-Athlete ID.
        </Text>
        {hasIcu ? (
          <>
            <Text style={[font.body, { marginBottom: 4 }]}>מחובר · ספורטאי {icuAthlete || '0'}</Text>
            <Text style={[font.tiny, { marginBottom: spacing.md }]}>
              {R.profile.sync_error
                ? `שגיאה: ${R.profile.sync_error}`
                : R.profile.last_sync_at
                  ? `סנכרון אחרון: ${new Date(R.profile.last_sync_at).toLocaleString('he-IL')} · ${R.profile.last_sync_status ?? ''}`
                  : 'עוד לא סונכרן'}
            </Text>
            <Button
              title="סנכרון עכשיו"
              variant="secondary"
              loading={icuBusy}
              onPress={async () => {
                setIcuBusy(true);
                try {
                  const r = await syncIntervals();
                  toast(`סונכרנו ${r.upserted} ריצות`);
                } catch (e) {
                  Alert.alert('הסנכרון נכשל', e instanceof Error ? e.message : String(e));
                } finally {
                  setIcuBusy(false);
                }
              }}
            />
            <Button title="ניתוק" variant="ghost" onPress={removeIcu} style={{ marginTop: spacing.sm }} />
          </>
        ) : (
          <>
            <Field label="Athlete ID" placeholder="i123456" value={icuAthlete} onChangeText={setIcuAthlete} autoCapitalize="none" autoCorrect={false} />
            <Field label="API key" value={icuKey} onChangeText={setIcuKey} autoCapitalize="none" autoCorrect={false} secureTextEntry />
            <Button title="חיבור וסנכרון" onPress={saveIcu} loading={icuBusy} disabled={!icuKey.trim()} />
            <Button title="פתיחת intervals.icu" variant="ghost" onPress={() => Linking.openURL('https://intervals.icu/settings')} style={{ marginTop: spacing.sm }} />
          </>
        )}
        <Divider />
        <Text style={[font.small, { marginBottom: spacing.sm, fontWeight: '600' }]}>דופק (לאזורי אימון)</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="מקסימלי" keyboardType="number-pad" value={hrMax} onChangeText={setHrMax} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="במנוחה" keyboardType="number-pad" value={hrRest} onChangeText={setHrRest} />
          </View>
        </View>
        <Button title="שמירת דופק" variant="secondary" onPress={saveHr} />
      </Card>

      <SectionTitle>אימוני כוח</SectionTitle>
      <Card>
        <Stepper
          label="מנוחה ברירת מחדל"
          value={L.settings.defaultRestSec}
          step={15}
          format={(n) => (n ? fmtClock(n) : 'כבוי')}
          onChange={(n) => setSettings({ defaultRestSec: Math.max(0, Math.min(600, n)) })}
        />
        <Stepper
          label={profile.units === 'imperial' ? 'קפיצת משקל (lb)' : 'קפיצת משקל (ק״ג)'}
          value={profile.units === 'imperial' ? L.settings.incLb : L.settings.incKg}
          step={profile.units === 'imperial' ? 2.5 : 0.5}
          onChange={(n) =>
            profile.units === 'imperial'
              ? setSettings({ incLb: Math.max(1, Math.min(20, n)) })
              : setSettings({ incKg: Math.max(0.5, Math.min(10, Math.round(n * 2) / 2)) })
          }
        />
        <Stepper
          label="יעד אימונים לשבוע"
          value={weeklyGoal()}
          onChange={(n) => setSettings({ weeklyGoal: Math.max(1, Math.min(7, n)) })}
        />
      </Card>

      <SectionTitle>גוף</SectionTitle>
      <Card>
        <Segmented<Sex>
          options={[
            { value: 'male', label: 'גבר' },
            { value: 'female', label: 'אישה' },
          ]}
          value={profile.sex}
          onChange={(sex) => patchProfile({ sex })}
        />
        <Field label="גובה (ס״מ)" keyboardType="number-pad" value={height} onChangeText={setHeight} />
        <Field label="שנת לידה" keyboardType="number-pad" value={birthYear} onChangeText={setBirthYear} />
        <Text style={[font.small, { marginBottom: 6, fontWeight: '600' }]}>פעילות יומית (בלי אימונים)</Text>
        <Segmented<ActivityLevel>
          options={[
            { value: 'sedentary', label: 'יושבני' },
            { value: 'light', label: 'קלה' },
            { value: 'moderate', label: 'בינונית' },
            { value: 'active', label: 'פעיל' },
          ]}
          value={profile.activity === 'very_active' ? 'active' : profile.activity}
          onChange={(activity) => patchProfile({ activity })}
        />
        <Button title="שמירה" onPress={saveBody} />
      </Card>

      <SectionTitle>יחידות</SectionTitle>
      <Card>
        <Segmented<Units>
          options={[
            { value: 'metric', label: 'ק״ג / ס״מ' },
            { value: 'imperial', label: 'lb / ft' },
          ]}
          value={profile.units}
          onChange={(units) => patchProfile({ units })}
          style={{ marginBottom: 0 }}
        />
      </Card>

      <SectionTitle>נתונים</SectionTitle>
      <Card>
        <Button
          title="חישוב הוצאה קלורית עכשיו"
          variant="secondary"
          onPress={async () => {
            await updateExpenditureIfNeeded(true);
            await refreshProfile();
            toast('חושב מחדש');
          }}
        />
        <Button title="מחיקת כל הנתונים" variant="danger" onPress={resetAll} style={{ marginTop: spacing.sm }} />
      </Card>
      <Text style={[font.tiny, { textAlign: 'center', marginTop: spacing.md }]}>Life · תזונה, כוח וריצה במקום אחד</Text>
    </Screen>
  );
}
