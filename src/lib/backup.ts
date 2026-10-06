// Whole-app backup: the nutrition tables plus every JSON document (strength, running) as one
// JSON snapshot. Used for the cloud backup (Supabase) and for a manual backup file.
import { getDb } from '../db';

const TABLES = ['profile', 'weight_entries', 'foods', 'food_log', 'expenditure_history', 'settings', 'docs'] as const;

export interface Snapshot {
  app: 'life';
  version: 1;
  exportedAt: string;
  tables: Record<string, Array<Record<string, unknown>>>;
}

export async function exportSnapshot(): Promise<Snapshot> {
  const db = await getDb();
  const tables: Snapshot['tables'] = {};
  for (const t of TABLES) {
    // The Ministry of Health food database ships with the app; no need to copy it.
    const where = t === 'foods' ? " WHERE source <> 'moh'" : '';
    tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}${where}`);
  }
  return { app: 'life', version: 1, exportedAt: new Date().toISOString(), tables };
}

/** Replaces all local data with the snapshot. Caller re-initialises the stores afterwards. */
export async function importSnapshot(s: Snapshot): Promise<void> {
  if (!s || s.app !== 'life' || !s.tables) throw new Error('הקובץ לא נראה כמו גיבוי של Life');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of TABLES) {
      const rows = s.tables[t];
      if (!Array.isArray(rows)) continue;
      await db.runAsync(t === 'foods' ? "DELETE FROM foods WHERE source <> 'moh'" : `DELETE FROM ${t}`);
      for (const row of rows) {
        const cols = Object.keys(row);
        if (!cols.length) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          ...cols.map((c) => row[c] as string | number | null),
        );
      }
    }
  });
}

export function snapshotSummary(s: Snapshot) {
  const n = (t: string) => s.tables[t]?.length ?? 0;
  const docs = (s.tables.docs ?? []) as Array<{ collection: string }>;
  const c = (col: string) => docs.filter((d) => d.collection === col).length;
  return {
    foodLog: n('food_log'),
    weights: n('weight_entries'),
    workouts: c('lift_workouts'),
    runs: c('run_activities'),
  };
}
