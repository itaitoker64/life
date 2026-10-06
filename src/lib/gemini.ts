// Minimal Gemini REST client (generateContent) with structured JSON output.
// Called straight from the phone with the user's own key; there is no server in between.
import { z } from 'zod';
import { getApiKey } from './secrets';

// Same models Stride used: newest flash first, then the rolling alias.
export const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class MissingApiKeyError extends Error {
  constructor() {
    super('לא נשמר מפתח Gemini. אפשר להוסיף אותו בהגדרות.');
  }
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiUsage {
  model: string;
  input: number;
  output: number;
}

// Gemini accepts a JSON Schema subset; strip keys it rejects.
function toGeminiSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const clean = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (k === '$schema' || k === 'additionalProperties') continue;
        out[k] = clean(val);
      }
      return out;
    }
    return v;
  };
  return clean(json);
}

function isTransient(status: number) {
  return status === 429 || status === 500 || status === 503;
}

/**
 * Sends one request and parses the reply against `schema`. Tries each model in turn and retries
 * transient errors (overload / rate limit) with backoff.
 */
export async function generateJson<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  parts: GeminiPart[];
  temperature?: number;
  apiKey?: string;
}): Promise<{ data: z.infer<T>; usage: GeminiUsage }> {
  const apiKey = opts.apiKey ?? (await getApiKey());
  if (!apiKey) throw new MissingApiKeyError();
  const responseJsonSchema = toGeminiSchema(opts.schema);
  // If the API rejects the schema field, fall back to plain JSON mode with the schema in the prompt.
  let useSchema = true;
  let lastErr: unknown = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: useSchema ? opts.system : `${opts.system}

Reply with JSON matching this JSON Schema:
${JSON.stringify(responseJsonSchema)}` }],
            },
            contents: [{ role: 'user', parts: opts.parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              ...(useSchema ? { responseJsonSchema } : {}),
              temperature: opts.temperature ?? 0.2,
            },
          }),
        });
      } catch (e) {
        lastErr = new GeminiError('אין חיבור לאינטרנט, או ש-Gemini לא זמין כרגע.', 0);
        break;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const msg: string = body?.error?.message ?? `HTTP ${res.status}`;
        lastErr = new GeminiError(msg, res.status);
        if (isTransient(res.status)) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
        if (res.status === 400 && useSchema && /schema/i.test(msg)) {
          useSchema = false;
          attempt--;
          continue;
        }
        // Unknown model → try the next one; anything else (bad key, bad request) is final.
        if (res.status === 404) break;
        throw lastErr;
      }
      const text: string = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
      const finish = body?.candidates?.[0]?.finishReason;
      if (!text) throw new GeminiError(finish === 'SAFETY' ? 'Gemini סירב לנתח את התמונה.' : 'Gemini החזיר תשובה ריקה.', 200);
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new GeminiError('לא הצלחתי לקרוא את התשובה של Gemini.', 200);
      }
      const result = opts.schema.safeParse(parsed);
      if (!result.success) throw new GeminiError('התשובה של Gemini לא במבנה הצפוי. נסו שוב.', 200);
      const u = body?.usageMetadata ?? {};
      return {
        data: result.data,
        usage: { model, input: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) },
      };
    }
  }
  throw lastErr ?? new GeminiError('Gemini לא זמין כרגע.', 503);
}

export function describeGeminiError(err: unknown): string {
  if (err instanceof MissingApiKeyError) return err.message;
  if (err instanceof GeminiError) {
    if (err.status === 400 && /API key/i.test(err.message)) return 'המפתח של Gemini לא תקין. בדקו אותו בהגדרות.';
    if (err.status === 403) return 'למפתח אין הרשאה ל-Gemini API. בדקו אותו ב-Google AI Studio.';
    if (err.status === 429) return 'הגעתם למגבלת השימוש החינמית של Gemini. נסו שוב בעוד דקה.';
    if (err.status === 503 || err.status === 500) return 'Gemini עמוס כרגע. נסו שוב בעוד רגע.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'משהו השתבש.';
}
