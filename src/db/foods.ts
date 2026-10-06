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
  // Every word must appear (any order) in the Hebrew name, English name or brand: "חזה עוף" finds
  // "בשר עוף, חזה …" as well as "שניצל חזה עוף".
  const tokens = q.split(/[\s,]+/).filter(Boolean).slice(0, 6);
  const where = tokens.map(() => '(name LIKE ? COLLATE NOCASE OR name_en LIKE ? COLLATE NOCASE OR brand LIKE ? COLLATE NOCASE)').join(' AND ');
  const args = tokens.flatMap((t) => [`%${t}%`, `%${t}%`, `%${t}%`]);
  const rows = await db.getAllAsync<Food>(`SELECT * FROM foods WHERE ${where} LIMIT 400`, ...args);
  return rows
    .map((f) => ({ f, score: rankFood(f, q, tokens) }))
    .sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => x.f);
}

// Composite / processed foods sink unless the query asks for them, so the plain item comes first.
const PROCESSED = ['שניצל', 'נקניק', 'פסטרמה', 'ציפוי', 'במילוי', 'ממולא', 'סלט', 'מוקפצ', 'אטריות', 'ברוטב', 'קטשופ', 'טורטיה', 'פירורי', 'מקדונלדס', 'פיצה', 'כריך', 'עוגת'];

function rankFood(f: Food, q: string, tokens: string[]): number {
  const name = f.name;
  const lowerQ = q.toLowerCase();
  let score = 0;
  score += Math.min(50, f.use_count * 5); // foods you already log
  if (f.source !== 'moh') score += 10; // your own / scanned foods
  if (name === q || f.name_en?.toLowerCase() === lowerQ) score += 40;
  if (name.startsWith(q) || f.name_en?.toLowerCase().startsWith(lowerQ)) score += 12;
  else if (tokens.length && name.startsWith(tokens[0])) score += 4;
  for (const w of PROCESSED) if (name.includes(w) && !q.includes(w)) score -= 30;
  if (name.includes('מטוגן') && !q.includes('מטוגן')) score -= 6;
  if (name.includes(' עם ') && !q.includes(' עם ')) score -= 10; // "X with Y" is a dish, not X
  for (const w of ['מיובש', 'אבקת', 'אבקה']) if (name.includes(w) && !q.includes(w)) score -= 12;
  score -= name.split(/\s+/).length * 0.5 + (name.match(/,/g)?.length ?? 0);
  return score;
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
