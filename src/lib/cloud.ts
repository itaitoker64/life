// Cloud backup on the user's own Supabase project: email + password sign-in, and one row per
// user in `backups` (protected by row-level security) holding the latest snapshot.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { exportSnapshot, importSnapshot, type Snapshot } from './backup';

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseKey?: string };

export const supabase = extra.supabaseUrl && extra.supabaseKey
  ? createClient(extra.supabaseUrl, extra.supabaseKey, {
      auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

const LAST_KEY = 'cloud_last_backup';

export const useCloud = create<{ session: Session | null; lastBackup: string | null; busy: boolean }>(() => ({
  session: null,
  lastBackup: null,
  busy: false,
}));

export async function initCloud() {
  if (!supabase) return;
  const [{ data }, last] = await Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(LAST_KEY)]);
  useCloud.setState({ session: data.session, lastBackup: last });
  supabase.auth.onAuthStateChange((_e, session) => useCloud.setState({ session }));
}

function heError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'אימייל או סיסמה שגויים.';
  if (/email not confirmed/i.test(msg)) return 'צריך לאשר את האימייל קודם — לחצו על הקישור במייל מ-Supabase.';
  if (/already registered|already been registered/i.test(msg)) return 'כבר יש חשבון עם האימייל הזה. התחברו במקום להירשם.';
  if (/password/i.test(msg) && /6/.test(msg)) return 'הסיסמה צריכה להיות לפחות 6 תווים.';
  if (/rate limit/i.test(msg)) return 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.';
  if (/network|fetch/i.test(msg)) return 'אין חיבור לאינטרנט.';
  return msg;
}

export async function signUp(email: string, password: string): Promise<'confirm' | 'signed_in'> {
  if (!supabase) throw new Error('הענן לא מוגדר');
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(heError(error.message));
  return data.session ? 'signed_in' : 'confirm';
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('הענן לא מוגדר');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(heError(error.message));
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function backupNow(): Promise<number> {
  const session = useCloud.getState().session;
  if (!supabase || !session) throw new Error('צריך להתחבר קודם');
  useCloud.setState({ busy: true });
  try {
    const snap = await exportSnapshot();
    const data = JSON.stringify(snap);
    const { error } = await supabase
      .from('backups')
      .upsert({ user_id: session.user.id, data, size_bytes: data.length, updated_at: new Date().toISOString() });
    if (error) throw new Error(heError(error.message));
    const now = new Date().toISOString();
    await AsyncStorage.setItem(LAST_KEY, now);
    useCloud.setState({ lastBackup: now });
    return data.length;
  } finally {
    useCloud.setState({ busy: false });
  }
}

export async function cloudBackupInfo(): Promise<{ updated_at: string; size_bytes: number | null } | null> {
  const session = useCloud.getState().session;
  if (!supabase || !session) return null;
  const { data, error } = await supabase.from('backups').select('updated_at, size_bytes').eq('user_id', session.user.id).maybeSingle();
  if (error) throw new Error(heError(error.message));
  return data;
}

export async function restoreFromCloud(): Promise<void> {
  const session = useCloud.getState().session;
  if (!supabase || !session) throw new Error('צריך להתחבר קודם');
  useCloud.setState({ busy: true });
  try {
    const { data, error } = await supabase.from('backups').select('data').eq('user_id', session.user.id).maybeSingle();
    if (error) throw new Error(heError(error.message));
    if (!data) throw new Error('אין גיבוי בענן עדיין');
    await importSnapshot(JSON.parse(data.data) as Snapshot);
  } finally {
    useCloud.setState({ busy: false });
  }
}

/** Automatic backup when the app goes to the background, at most every 15 minutes. */
export async function autoBackup() {
  const { session, lastBackup, busy } = useCloud.getState();
  if (!supabase || !session || busy) return;
  if (lastBackup && Date.now() - Date.parse(lastBackup) < 15 * 60_000) return;
  try {
    await backupNow();
  } catch (e) {
    console.warn('auto backup failed', e);
  }
}
