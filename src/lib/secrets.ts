import * as Secure from 'expo-secure-store';
import { Platform } from 'react-native';

// The browser preview has no keychain; fall back to localStorage there (development only).
const SecureStore =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        setItemAsync: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        deleteItemAsync: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : Secure;

// All keys are the user's own and stay in the device keychain.
const GEMINI_KEY = 'gemini_api_key';
const ICU_KEY = 'intervals_api_key';
const ICU_ATHLETE = 'intervals_athlete_id';

// Keys pasted from Hebrew text / Word often carry invisible direction marks or spaces; Android's
// HTTP client then rejects the request header outright. Keep only characters a key can contain.
export function cleanKey(key: string): string {
  // Letters, digits, '_', '-' and '.' (Vertex express keys look like "AQ.Ab8…").
  return key.replace(/[^A-Za-z0-9_.\-]/g, '');
}

export async function getApiKey(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(GEMINI_KEY);
  let k = raw ? cleanKey(raw) : '';
  // An earlier version stripped the dot from Vertex keys ("AQ.Ab8…" → "AQAb8…"); put it back.
  if (/^AQ[^.]/.test(k)) k = `AQ.${k.slice(2)}`;
  return k || null;
}

export function setApiKey(key: string): Promise<void> {
  return SecureStore.setItemAsync(GEMINI_KEY, cleanKey(key));
}

export function clearApiKey(): Promise<void> {
  return SecureStore.deleteItemAsync(GEMINI_KEY);
}

export async function getIntervalsCreds(): Promise<{ apiKey: string; athleteId: string } | null> {
  const [apiKey, athleteId] = await Promise.all([SecureStore.getItemAsync(ICU_KEY), SecureStore.getItemAsync(ICU_ATHLETE)]);
  return apiKey ? { apiKey: cleanKey(apiKey), athleteId: cleanKey(athleteId || '') || '0' } : null;
}

export async function setIntervalsCreds(apiKey: string, athleteId: string): Promise<void> {
  await SecureStore.setItemAsync(ICU_KEY, cleanKey(apiKey));
  await SecureStore.setItemAsync(ICU_ATHLETE, cleanKey(athleteId) || '0');
}

export async function clearIntervalsCreds(): Promise<void> {
  await SecureStore.deleteItemAsync(ICU_KEY);
  await SecureStore.deleteItemAsync(ICU_ATHLETE);
}
