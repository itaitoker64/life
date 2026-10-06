import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { getApiKey, setApiKey } from '../lib/secrets';
import { colors, font, spacing } from '../theme';
import { Button, Card, Field } from './ui';

export function ApiKeyPrompt({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const k = key.trim();
    if (!k.startsWith('sk-ant-')) {
      setError('That does not look like an Anthropic key. It should start with sk-ant-');
      return;
    }
    setBusy(true);
    await setApiKey(k);
    const stored = await getApiKey();
    setBusy(false);
    if (!stored) {
      setError('Could not save the key on this device. Try again.');
      return;
    }
    setKey('');
    setError('');
    onSaved();
  }

  return (
    <Card style={{ borderWidth: 1, borderColor: colors.warning }}>
      <Text style={[font.h3, { marginBottom: 4 }]}>Add your Anthropic API key</Text>
      <Text style={[font.small, { lineHeight: 19, marginBottom: spacing.md }]}>
        AI photo logging and label reading need a key. Create one at{' '}
        <Text style={{ color: colors.info, fontWeight: '600' }} onPress={() => Linking.openURL('https://console.anthropic.com/settings/keys')}>
          console.anthropic.com
        </Text>{' '}
        (add a few dollars of credit under Billing), then paste it here. It is stored encrypted on this phone only.
      </Text>
      <Field
        placeholder="sk-ant-..."
        value={key}
        onChangeText={(t) => {
          setKey(t);
          setError('');
        }}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      {error ? <Text style={[font.small, { color: colors.danger, marginBottom: spacing.sm }]}>{error}</Text> : null}
      <Button title="Save key" onPress={save} loading={busy} disabled={!key.trim()} />
    </Card>
  );
}
