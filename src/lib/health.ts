// Health Connect (Android): weigh-ins from a smart scale / Garmin into the weight log, and today's
// steps. Read-only. Weigh-ins typed by hand always win over imported ones for the same day.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { upsertWeight, weightForDate } from '../db/weight';
import { toISODate } from './dates';

const ENABLED_KEY = 'health_connect_enabled';
const SOURCE = 'health_connect';
const PERMS = [
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Steps' },
] as const;

type HC = typeof import('react-native-health-connect');
let mod: HC | null | undefined;
function hc(): HC | null {
  if (mod !== undefined) return mod;
  try {
    mod = Platform.OS === 'android' ? (require('react-native-health-connect') as HC) : null;
  } catch {
    mod = null; // Expo Go / older APK without the native module
  }
  return mod;
}

export type HealthStatus = 'unsupported' | 'needs_install' | 'off' | 'on';

export async function healthStatus(): Promise<HealthStatus> {
  const m = hc();
  if (!m) return 'unsupported';
  try {
    const sdk = await m.getSdkStatus();
    if (sdk !== m.SdkAvailabilityStatus.SDK_AVAILABLE) return 'needs_install';
    return (await AsyncStorage.getItem(ENABLED_KEY)) === '1' ? 'on' : 'off';
  } catch {
    return 'unsupported';
  }
}

export async function enableHealth(): Promise<boolean> {
  const m = hc();
  if (!m) return false;
  if (!(await m.initialize())) return false;
  const granted = await m.requestPermission([...PERMS] as any);
  const ok = granted.some((p: any) => p.recordType === 'Weight');
  await AsyncStorage.setItem(ENABLED_KEY, ok ? '1' : '0');
  return ok;
}

export async function disableHealth() {
  await AsyncStorage.setItem(ENABLED_KEY, '0');
}

export function openHealthSettings() {
  hc()?.openHealthConnectSettings();
}

/** Imports weigh-ins from the last `days` days. Returns how many days were written. */
export async function syncHealthWeights(days = 60): Promise<number> {
  const m = hc();
  if (!m || (await AsyncStorage.getItem(ENABLED_KEY)) !== '1') return 0;
  await m.initialize();
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const res = await m.readRecords('Weight', {
    timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
  });
  // Last reading of each local day.
  const byDay = new Map<string, { t: number; kg: number }>();
  for (const r of res.records as any[]) {
    const t = Date.parse(r.time);
    const kg = r.weight?.inKilograms;
    if (!kg || !Number.isFinite(t)) continue;
    const d = toISODate(new Date(t));
    const cur = byDay.get(d);
    if (!cur || t > cur.t) byDay.set(d, { t, kg });
  }
  let n = 0;
  for (const [date, { kg }] of byDay) {
    const existing = await weightForDate(date);
    if (existing && existing.note !== SOURCE) continue;
    if (existing && Math.abs(existing.weight_kg - kg) < 0.01) continue;
    await upsertWeight(date, Math.round(kg * 100) / 100, SOURCE);
    n++;
  }
  return n;
}

export async function stepsToday(): Promise<number | null> {
  const m = hc();
  if (!m || (await AsyncStorage.getItem(ENABLED_KEY)) !== '1') return null;
  try {
    await m.initialize();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const r = await m.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: new Date().toISOString() },
    });
    return (r as any).COUNT_TOTAL ?? null;
  } catch {
    return null;
  }
}
