import { getDb } from './index';

export async function recordAiUsage(kind: string, model: string, inputTokens: number, outputTokens: number, costUsd: number) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO ai_usage (kind, model, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?)',
    kind,
    model,
    inputTokens,
    outputTokens,
    costUsd,
  );
}

export interface UsageBucket {
  calls: number;
  photos: number;
  labels: number;
  input: number;
  output: number;
  cost: number;
}

async function bucket(where: string): Promise<UsageBucket> {
  const db = await getDb();
  const row = await db.getFirstAsync<UsageBucket>(
    `SELECT COUNT(*) calls,
            COALESCE(SUM(kind = 'photo'), 0) photos,
            COALESCE(SUM(kind = 'label'), 0) labels,
            COALESCE(SUM(input_tokens), 0) input,
            COALESCE(SUM(output_tokens), 0) output,
            COALESCE(SUM(cost_usd), 0) cost
     FROM ai_usage ${where}`,
  );
  return row ?? { calls: 0, photos: 0, labels: 0, input: 0, output: 0, cost: 0 };
}

export async function aiUsageSummary() {
  const [month, all] = await Promise.all([
    bucket("WHERE created_at >= strftime('%Y-%m-01', 'now', 'localtime')"),
    bucket(''),
  ]);
  return { month, all };
}
