import type { SQLiteDatabase } from 'expo-sqlite';
import mohFoods from '../data/moh_foods.json';

// [code, name_he, name_en, kcal, protein, carbs, fat, fiber, sugar, sodium_mg, serving_g, serving_name]
type MohRow = [
  number,
  string,
  string | null,
  number,
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  string | null,
];

// Israeli Ministry of Health national nutrition database (data.gov.il/dataset/nutrition-database).
export async function seedFoods(db: SQLiteDatabase) {
  const stmt = await db.prepareAsync(
    `INSERT INTO foods (name, name_en, barcode, source, kcal, protein, carbs, fat, fiber, sugar, sodium_mg, serving_g, serving_name)
     VALUES (?, ?, ?, 'moh', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const r of mohFoods as MohRow[]) {
        const [code, he, en, kcal, p, c, f, fiber, sugar, sodium, servingG, servingName] = r;
        await stmt.executeAsync(he, en, `moh:${code}`, kcal, p, c, f, fiber, sugar, sodium, servingG, servingName);
      }
    });
  } finally {
    await stmt.finalizeAsync();
  }
}
