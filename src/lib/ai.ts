// Food photo analysis and nutrition-label reading with Gemini (free tier, the user's own key).
import * as ImageManipulator from 'expo-image-manipulator';
import { z } from 'zod';
import { cacheLabel } from '../db/foods';
import { recordAiUsage } from '../db/usage';
import { MissingApiKeyError, describeGeminiError, generateJson, type GeminiUsage } from './gemini';
import { getApiKey } from './secrets';

export { MissingApiKeyError };

// A plate of food is recognisable at 768 px; small label text needs a bit more.
const PHOTO_EDGE = 768;
const LABEL_EDGE = 1280;

export interface ImageAsset {
  uri: string;
  width: number;
  height: number;
}

export async function hasApiKey(): Promise<boolean> {
  return !!(await getApiKey());
}

async function toJpegBase64(img: ImageAsset, maxEdge: number): Promise<string> {
  const ctx = ImageManipulator.ImageManipulator.manipulate(img.uri);
  const landscape = img.width >= img.height;
  const longEdge = landscape ? img.width : img.height;
  if (!longEdge || longEdge > maxEdge) {
    ctx.resize(landscape ? { width: maxEdge } : { height: maxEdge });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!out.base64) throw new Error('לא הצלחתי לקודד את התמונה');
  return out.base64;
}

// Gemini's free tier costs nothing; tokens are still recorded so usage is visible.
async function logUsage(kind: 'photo' | 'label', u: GeminiUsage) {
  await recordAiUsage(kind, u.model, u.input, u.output, 0).catch(() => {});
}

const PhotoIngredient = z.object({
  name: z.string().describe('Ingredient as it would appear in a recipe, e.g. "Heavy cream" or "Spaghetti, cooked"'),
  grams: z.number().describe('Grams of this ingredient in the portion shown'),
  kcal: z.number().describe('Calories for those grams'),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

const PhotoDish = z.object({
  name: z.string().describe('Dish name as a person would log it, e.g. "Spaghetti alfredo"'),
  confidence: z.enum(['low', 'medium', 'high']),
  ingredients: z.array(PhotoIngredient),
});

const PhotoResult = z.object({
  dishes: z.array(PhotoDish),
  notes: z.string().describe('One short sentence about assumptions made, or empty string'),
});

export type PhotoDishResult = z.infer<typeof PhotoDish>;

export async function analyzeFoodPhoto(img: ImageAsset, hint?: string): Promise<z.infer<typeof PhotoResult>> {
  const data = await toJpegBase64(img, PHOTO_EDGE);
  const { data: result, usage } = await generateJson({
    schema: PhotoResult,
    system:
      'You are a nutrition assistant inside a calorie-tracking app used in Israel. Identify each distinct dish in the ' +
      'photo and break it into the ingredients a recipe for it would list, including the ones you cannot see directly ' +
      'but that are almost certainly there: cooking oil or butter, cream, cheese, sauces, dressings, tahini, sugar, ' +
      'breading. Estimate grams of each ingredient in the portion shown using visual cues (plate size, utensils, ' +
      'packaging) and give its calories and macros from standard nutrition data. Skip ingredients with negligible ' +
      'calories such as salt, spices, herbs and water. A single-ingredient food, like an apple, is a dish with one ' +
      'ingredient. Be realistic, not conservative. Write dish names, ingredient names and notes in Hebrew. If the photo ' +
      'has no food, return an empty dishes array.',
    parts: [
      { inlineData: { mimeType: 'image/jpeg', data } },
      { text: hint?.trim() ? `Context from the user: ${hint.trim()}` : 'Analyze this meal.' },
    ],
  });
  await logUsage('photo', usage);
  return result;
}

// The model only transcribes what is printed; unit and per-100 g conversions happen in code below,
// which is exact.
const LabelRaw = z.object({
  readable: z.boolean().describe('False if the nutrition table is too blurry or cropped to read reliably'),
  product_name: z.string().nullable(),
  brand: z.string().nullable(),
  basis: z
    .enum(['per_100', 'per_serving'])
    .describe('Which column the numbers come from. Use the per 100 g / 100 ml column whenever the label has one.'),
  serving_size_g: z.number().nullable().describe('Serving size in g or ml exactly as printed, or null'),
  serving_name: z.string().nullable().describe('Serving description as printed, e.g. "1 bar (45 g)", or null'),
  energy: z.number().describe('Energy in the chosen column. If both kcal and kJ are printed, give the kcal value.'),
  energy_unit: z.enum(['kcal', 'kJ']),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sodium_mg: z.number().nullable().describe('Sodium in mg if printed, else null'),
  salt_g: z.number().nullable().describe('Salt in g if printed, else null'),
});

export interface LabelData {
  product_name: string | null;
  brand: string | null;
  serving_size_g: number | null;
  serving_name: string | null;
  readable: boolean;
  per_100g: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
  };
}

function normalizeLabel(r: z.infer<typeof LabelRaw>): LabelData {
  const factor =
    r.basis === 'per_100' ? 1 : r.serving_size_g != null && r.serving_size_g > 0 ? 100 / r.serving_size_g : null;
  const sc = (v: number | null) => (v == null || factor == null ? null : Math.round(v * factor * 10) / 10);
  const kcalPrinted = r.energy_unit === 'kJ' ? r.energy / 4.184 : r.energy;
  const sodium = r.sodium_mg ?? (r.salt_g != null ? r.salt_g * 400 : null);
  return {
    product_name: r.product_name,
    brand: r.brand,
    serving_size_g: r.serving_size_g,
    serving_name: r.serving_name,
    // Per-serving values with no printed serving size cannot be turned into per-100 g numbers.
    readable: r.readable && factor != null,
    per_100g: {
      kcal: Math.round(kcalPrinted * (factor ?? 1)),
      protein_g: sc(r.protein_g) ?? 0,
      carbs_g: sc(r.carbs_g) ?? 0,
      fat_g: sc(r.fat_g) ?? 0,
      fiber_g: sc(r.fiber_g),
      sugar_g: sc(r.sugar_g),
      sodium_mg: sodium == null || factor == null ? null : Math.round(sodium * factor),
    },
  };
}

export async function readNutritionLabel(img: ImageAsset, barcode?: string): Promise<LabelData> {
  const data = await toJpegBase64(img, LABEL_EDGE);
  const { data: raw, usage } = await generateJson({
    schema: LabelRaw,
    temperature: 0,
    system:
      'You transcribe nutrition facts tables from product packaging photos. Labels may be in any language, including ' +
      'Hebrew. Copy the numbers exactly as printed; do not convert units or recompute anything. Report the product ' +
      'name and brand if visible anywhere in the photo, in the language printed.',
    parts: [{ inlineData: { mimeType: 'image/jpeg', data } }, { text: 'Transcribe this nutrition label.' }],
  });
  await logUsage('label', usage);
  const label = normalizeLabel(raw);
  if (barcode && label.readable) await cacheLabel(barcode, label);
  return label;
}

export function describeAiError(err: unknown): string {
  return describeGeminiError(err);
}
