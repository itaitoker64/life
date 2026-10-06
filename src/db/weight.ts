import { getDb } from './index';
import type { WeightEntry } from './types';
import type { ISODate } from '../lib/dates';

export async function allWeights(): Promise<WeightEntry[]> {
  const db = await getDb();
  return db.getAllAsync<WeightEntry>('SELECT * FROM weight_entries ORDER BY date');
}

export async function latestWeight(): Promise<WeightEntry | null> {
  const db = await getDb();
  return db.getFirstAsync<WeightEntry>('SELECT * FROM weight_entries ORDER BY date DESC LIMIT 1');
}

export async function weightForDate(date: ISODate): Promise<WeightEntry | null> {
  const db = await getDb();
  return db.getFirstAsync<WeightEntry>('SELECT * FROM weight_entries WHERE date = ?', date);
}

export async function upsertWeight(date: ISODate, weightKg: number, note: string | null = null) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO weight_entries (date, weight_kg, note) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, note = excluded.note`,
    date,
    weightKg,
    note,
  );
}

export async function deleteWeight(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM weight_entries WHERE id = ?', id);
}
