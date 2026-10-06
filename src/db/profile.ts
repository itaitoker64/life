import { getDb } from './index';
import type { Profile } from './types';

export async function getProfile(): Promise<Profile> {
  const db = await getDb();
  return (await db.getFirstAsync<Profile>('SELECT * FROM profile WHERE id = 1'))!;
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  const db = await getDb();
  const keys = Object.keys(patch) as Array<keyof typeof patch>;
  if (keys.length) {
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    await db.runAsync(`UPDATE profile SET ${sets} WHERE id = 1`, ...keys.map((k) => patch[k] as any));
  }
  return getProfile();
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export interface ExpenditureRow {
  date: string;
  tdee: number;
  raw_estimate: number | null;
  logged_days: number;
}

export async function expenditureHistory(limit = 90): Promise<ExpenditureRow[]> {
  const db = await getDb();
  return db.getAllAsync<ExpenditureRow>('SELECT * FROM expenditure_history ORDER BY date DESC LIMIT ?', limit);
}

export async function allExpenditure(): Promise<ExpenditureRow[]> {
  const db = await getDb();
  return db.getAllAsync<ExpenditureRow>('SELECT * FROM expenditure_history ORDER BY date');
}

export async function recordExpenditure(date: string, tdee: number, raw: number | null, loggedDays: number) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO expenditure_history (date, tdee, raw_estimate, logged_days) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET tdee = excluded.tdee, raw_estimate = excluded.raw_estimate, logged_days = excluded.logged_days`,
    date,
    tdee,
    raw,
    loggedDays,
  );
}
