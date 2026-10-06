import * as SecureStore from 'expo-secure-store';

// All keys are the user's own and stay in the device keychain.
const GEMINI_KEY = 'gemini_api_key';
const ICU_KEY = 'intervals_api_key';
const ICU_ATHLETE = 'intervals_athlete_id';

export function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(GEMINI_KEY);
}

export function setApiKey(key: string): Promise<void> {
  return SecureStore.setItemAsync(GEMINI_KEY, key.trim());
}

export function clearApiKey(): Promise<void> {
  return SecureStore.deleteItemAsync(GEMINI_KEY);
}

export async function getIntervalsCreds(): Promise<{ apiKey: string; athleteId: string } | null> {
  const [apiKey, athleteId] = await Promise.all([SecureStore.getItemAsync(ICU_KEY), SecureStore.getItemAsync(ICU_ATHLETE)]);
  return apiKey ? { apiKey, athleteId: athleteId || '0' } : null;
}

export async function setIntervalsCreds(apiKey: string, athleteId: string): Promise<void> {
  await SecureStore.setItemAsync(ICU_KEY, apiKey.trim());
  await SecureStore.setItemAsync(ICU_ATHLETE, athleteId.trim() || '0');
}

export async function clearIntervalsCreds(): Promise<void> {
  await SecureStore.deleteItemAsync(ICU_KEY);
  await SecureStore.deleteItemAsync(ICU_ATHLETE);
}
