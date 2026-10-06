import { getDb } from './index';
import { getSetting, setSetting } from './profile';
import type { Food, FoodInput } from './types';

export async function searchFoods(query: string, limit = 40): Promise<Food[]> {
  const db = await getDb();
  const q = query.trim();
  if (!q) {
    return db.getAllAsync<Food>(
      `SELECT * FROM foods ORDER BY use_count DESC, last_used_at DESC, name LIMIT ?`,
      limit,
    );
  }
  const like = `%${q}%`;
  const prefix = `${q}%`;
  // Prefix matches rank above substring matches; user foods above the reference database.
  return db.getAllAsync<Food>(
    `SELECT * FROM foods
     WHERE name LIKE ? COLLATE NOCASE OR name_en LIKE ? COLLATE NOCASE OR brand LIKE ? COLLATE NOCASE
     ORDER BY use_count DESC,
              (name LIKE ? COLLATE NOCASE OR name_en LIKE ? COLLATE NOCASE) DESC,
              (source != 'moh') DESC,
              length(name)
     LIMIT ?`,
    like,
    like,
    like,
    prefix,
    prefix,
    limit,
  );
}

export async function recentFoods(limit = 20): Promise<Food[]> {
  const db = await getDb();
  return db.getAllAsync<Food>(
    `SELECT * FROM foods WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT ?`,
    limit,
  );
}

export async function getFood(id: number): Promise<Food | null> {
  const db = await getDb();
  return db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id);
}

// iOS reports UPC-A codes as 13-digit EAN with a leading 0 and Android as 12 digits, so the same
// product can arrive in either form. Matching both keeps a saved product from missing locally.
export function barcodeVariants(code: string): string[] {
  const c = code.trim();
  if (!/^\d+$/.test(c)) return [c];
  const out = new Set([c]);
  if (c.length === 13 && c.startsWith('0')) out.add(c.slice(1));
  if (c.length === 12) out.add(`0${c}`);
  return [...out];
}

function canonicalBarcode(code: string): string {
  const c = code.trim();
  return /^\d{13}$/.test(c) && c.startsWith('0') ? c.slice(1) : c;
}

export async function getFoodByBarcode(barcode: string): Promise<Food | null> {
  const db = await getDb();
  const v = barcodeVariants(barcode);
  return db.getFirstAsync<Food>(`SELECT * FROM foods WHERE barcode IN (${v.map(() => '?').join(',')})`, ...v);
}

// A label that was already read by AI is kept per barcode, so backing out before saving the food
// never costs a second API call for the same product.
export async function cacheLabel(barcode: string, label: unknown): Promise<void> {
  await setSetting(`label:${canonicalBarcode(barcode)}`, JSON.stringify(label));
}

export async function getCachedLabel(barcode: string): Promise<string | null> {
  return getSetting(`label:${canonicalBarcode(barcode)}`);
}

export async function insertFood(f: FoodInput): Promise<Food> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO foods (name, name_en, brand, barcode, source, kcal, protein, carbs, fat, fiber, sugar, sodium_mg, serving_g, serving_name, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    f.name,
    f.name_en,
    f.brand,
    f.barcode,
    f.source,
    f.kcal,
    f.protein,
    f.carbs,
    f.fat,
    f.fiber,
    f.sugar,
    f.sodium_mg,
    f.serving_g,
    f.serving_name,
    f.image_url,
  );
  return (await getFood(res.lastInsertRowId))!;
}

export async function updateFood(id: number, f: FoodInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE foods SET name=?, name_en=?, brand=?, barcode=?, source=?, kcal=?, protein=?, carbs=?, fat=?, fiber=?, sugar=?, sodium_mg=?, serving_g=?, serving_name=?, image_url=?
     WHERE id=?`,
    f.name,
    f.name_en,
    f.brand,
    f.barcode,
    f.source,
    f.kcal,
    f.protein,
    f.carbs,
    f.fat,
    f.fiber,
    f.sugar,
    f.sodium_mg,
    f.serving_g,
    f.serving_name,
    f.image_url,
    id,
  );
}

export async function deleteFood(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM foods WHERE id = ?', id);
}

export async function touchFood(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE foods SET use_count = use_count + 1, last_used_at = datetime('now') WHERE id = ?`,
    id,
  );
}
