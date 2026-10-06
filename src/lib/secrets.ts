import * as SecureStore from 'expo-secure-store';

const API_KEY = 'anthropic_api_key';

export function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY);
}

export function setApiKey(key: string): Promise<void> {
  return SecureStore.setItemAsync(API_KEY, key.trim());
}

export function clearApiKey(): Promise<void> {
  return SecureStore.deleteItemAsync(API_KEY);
}
