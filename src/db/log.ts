import { getDb } from './index';
import { touchFood } from './foods';
import type { DayTotals, LogEntry, LogEntryInput, Meal } from './types';
import type { ISODate } from '../lib/dates';

export async function entriesForDate(date: ISODate): Promise<LogEntry[]> {
  const db = await getDb();
  return db.getAllAsync<LogEntry>(
    'SELECT * FROM food_log WHERE date = ? ORDER BY created_at, id',
    date,
  );
}

export async function totalsForDate(date: ISODate): Promise<DayTotals> {
  const db = await getDb();
  const row = await db.getFirstAsync<DayTotals>(
    `SELECT COALESCE(SUM(kcal),0) kcal, COALESCE(SUM(protein),0) protein,
            COALESCE(SUM(carbs),0) carbs, COALESCE(SUM(fat),0) fat, COALESCE(SUM(fiber),0) fiber
     FROM food_log WHERE date = ?`,
    date,
  );
  return row ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

export async function dailyIntake(
  from: ISODate,
  to: ISODate,
): Promise<Array<{ date: ISODate; kcal: number }>> {
  const db = await getDb();
  return db.getAllAsync<{ date: ISODate; kcal: number }>(
    `SELECT date, SUM(kcal) kcal FROM food_log WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    from,
    to,
  );
}

export interface DailyTotal {
  date: ISODate;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function dailyTotals(from: ISODate, to: ISODate): Promise<DailyTotal[]> {
  const db = await getDb();
  return db.getAllAsync<DailyTotal>(
    `SELECT date, SUM(kcal) kcal, SUM(protein) protein, SUM(carbs) carbs, SUM(fat) fat
     FROM food_log WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    from,
    to,
  );
}

export async function addEntry(e: LogEntryInput): Promise<LogEntry> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO food_log (date, meal, food_id, name, grams, kcal, protein, carbs, fat, fiber, components)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    e.date,
    e.meal,
    e.food_id,
    e.name,
    e.grams,
    e.kcal,
    e.protein,
    e.carbs,
    e.fat,
    e.fiber,
    e.components ?? null,
  );
  if (e.food_id != null) await touchFood(e.food_id);
  return (await db.getFirstAsync<LogEntry>('SELECT * FROM food_log WHERE id = ?', res.lastInsertRowId))!;
}

export async function updateEntry(id: number, e: LogEntryInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE food_log SET date=?, meal=?, food_id=?, name=?, grams=?, kcal=?, protein=?, carbs=?, fat=?, fiber=?,
       components=COALESCE(?, components) WHERE id=?`,
    e.date,
    e.meal,
    e.food_id,
    e.name,
    e.grams,
    e.kcal,
    e.protein,
    e.carbs,
    e.fat,
    e.fiber,
    e.components ?? null,
    id,
  );
}

export async function moveEntry(id: number, meal: Meal): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE food_log SET meal = ? WHERE id = ?', meal, id);
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM food_log WHERE id = ?', id);
}

export async function getEntry(id: number): Promise<LogEntry | null> {
  const db = await getDb();
  return db.getFirstAsync<LogEntry>('SELECT * FROM food_log WHERE id = ?', id);
}
