import type { FoodInput } from '../db/types';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS =
  'code,product_name,product_name_he,product_name_en,brands,nutriments,serving_quantity,serving_size,image_front_small_url,quantity';
const HEADERS = { 'User-Agent': 'MacroFactorPersonal/1.0 (personal nutrition tracker)' };

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_he?: string;
  product_name_en?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, number | string | undefined>;
}

function num(v: number | string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toFood(p: OffProduct): FoodInput | null {
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const name = (p.product_name_he || p.product_name || p.product_name_en || '').trim();
  if (!name || kcal == null) return null;
  const sodiumG = num(n['sodium_100g']);
  const servingG = num(p.serving_quantity);
  const nameEn = (p.product_name_en || '').trim();
  return {
    name,
    name_en: nameEn && nameEn !== name ? nameEn : null,
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode: p.code ?? null,
    source: 'off',
    kcal: Math.round(kcal),
    protein: num(n['proteins_100g']) ?? 0,
    carbs: num(n['carbohydrates_100g']) ?? 0,
    fat: num(n['fat_100g']) ?? 0,
    fiber: num(n['fiber_100g']),
    sugar: num(n['sugars_100g']),
    sodium_mg: sodiumG != null ? Math.round(sodiumG * 1000) : null,
    serving_g: servingG,
    serving_name: p.serving_size?.trim() || (servingG ? `${servingG} g` : null),
    image_url: p.image_front_small_url ?? null,
  };
}

export async function lookupBarcode(barcode: string): Promise<FoodInput | null> {
  const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
    headers: HEADERS,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts error ${res.status}`);
  const json = (await res.json()) as { status?: number; product?: OffProduct };
  if (!json.product || json.status === 0) return null;
  const food = toFood({ ...json.product, code: json.product.code ?? barcode });
  return food;
}

async function runSearch(query: string, limit: number, israelOnly: boolean): Promise<FoodInput[]> {
  let url =
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1` +
    `&lc=he&page_size=${limit}&fields=${FIELDS}`;
  if (israelOnly) url += '&tagtype_0=countries&tag_contains_0=contains&tag_0=israel';
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Open Food Facts error ${res.status}`);
  const json = (await res.json()) as { products?: OffProduct[] };
  return (json.products ?? []).map(toFood).filter((f): f is FoodInput => f != null);
}

// Products sold in Israel first, then worldwide results to fill the list.
export async function searchProducts(query: string, limit = 20): Promise<FoodInput[]> {
  const israel = await runSearch(query, limit, true);
  if (israel.length >= limit) return israel;
  const world = await runSearch(query, limit, false);
  const seen = new Set(israel.map((f) => f.barcode));
  return [...israel, ...world.filter((f) => !seen.has(f.barcode))].slice(0, limit);
}
