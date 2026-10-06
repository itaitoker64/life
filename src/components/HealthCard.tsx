import { useEffect, useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import { disableHealth, enableHealth, healthStatus, openHealthSettings, syncHealthWeights, type HealthStatus } from '../lib/health';
import { useApp } from '../state/store';
import { font, spacing } from '../theme';
import { toast } from './sheet';
import { Button, Card, SectionTitle } from './ui';

export function HealthCard() {
  const bump = useApp((s) => s.bump);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    healthStatus().then(setStatus);
  }, []);
  if (!status || status === 'unsupported') return null;

  async function sync() {
    setBusy(true);
    try {
      const n = await syncHealthWeights(180);
      bump();
      toast(n ? `יובאו ${n} שקילות` : 'אין שקילות חדשות');
    } catch (e) {
      Alert.alert('הסנכרון נכשל', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle>Health Connect</SectionTitle>
      <Card>
        <Text style={[font.small, { marginBottom: spacing.md, lineHeight: 19 }]}>
          מייבא שקילות ממשקל חכם / Garmin / Samsung Health אל יומן המשקל, ומציג צעדים יומיים. שקילה שהזנת ידנית תמיד גוברת.
        </Text>
        {status === 'needs_install' ? (
          <Button title="התקנת Health Connect" onPress={() => Linking.openURL('market://details?id=com.google.android.apps.healthdata')} />
        ) : status === 'on' ? (
          <>
            <Button title="סנכרון שקילות עכשיו" variant="secondary" loading={busy} onPress={sync} />
            <Button title="הרשאות Health Connect" variant="ghost" style={{ marginTop: spacing.sm }} onPress={openHealthSettings} />
            <Button title="כיבוי" variant="ghost" onPress={async () => (await disableHealth(), setStatus('off'))} />
          </>
        ) : (
          <Button
            title="חיבור ל-Health Connect"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const ok = await enableHealth();
                setStatus(ok ? 'on' : 'off');
                if (ok) await sync();
                else toast('לא אושרה גישה למשקל');
              } catch (e) {
                Alert.alert('החיבור נכשל', e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </Card>
    </>
  );
}
