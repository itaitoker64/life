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
    if (k.length < 20) {
      setError('זה לא נראה כמו מפתח Gemini. העתיקו אותו שוב מ-Google AI Studio.');
      return;
    }
    setBusy(true);
    await setApiKey(k);
    const stored = await getApiKey();
    setBusy(false);
    if (!stored) {
      setError('לא הצלחתי לשמור את המפתח במכשיר. נסו שוב.');
      return;
    }
    setKey('');
    setError('');
    onSaved();
  }

  return (
    <Card style={{ borderColor: colors.warning }}>
      <Text style={[font.h3, { marginBottom: 4 }]}>הוסיפו מפתח Gemini</Text>
      <Text style={[font.small, { lineHeight: 19, marginBottom: spacing.md }]}>
        זיהוי אוכל מתמונה וקריאת תוויות עובדים עם מפתח Gemini חינמי. צרו מפתח ב-{' '}
        <Text style={{ color: colors.info, fontWeight: '600' }} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}>
          aistudio.google.com/apikey
        </Text>{' '}
        והדביקו אותו כאן. הוא נשמר מוצפן בטלפון בלבד.
      </Text>
      <Field
        placeholder="AIza..."
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
      <Button title="שמירת המפתח" onPress={save} loading={busy} disabled={!key.trim()} />
    </Card>
  );
}
