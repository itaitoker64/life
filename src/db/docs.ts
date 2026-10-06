import { getDb } from './index';

export async function loadCollection<T>(collection: string): Promise<T[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM docs WHERE collection = ?', collection);
  const out: T[] = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.data) as T);
    } catch {}
  }
  return out;
}

export async function loadDoc<T>(collection: string, id: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM docs WHERE collection = ? AND id = ?', collection, id);
  if (!row) return null;
  try {
    return JSON.parse(row.data) as T;
  } catch {
    return null;
  }
}

export async function saveDoc(collection: string, id: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO docs (collection, id, data, updated_at) VALUES (?, ?, ?, ?)',
    collection,
    id,
    JSON.stringify(value),
    Date.now(),
  );
}

export async function saveDocs(collection: string, items: Array<{ id: string }>): Promise<void> {
  if (!items.length) return;
  const db = await getDb();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (const it of items) {
      await db.runAsync(
        'INSERT OR REPLACE INTO docs (collection, id, data, updated_at) VALUES (?, ?, ?, ?)',
        collection,
        it.id,
        JSON.stringify(it),
        now,
      );
    }
  });
}

export async function deleteDoc(collection: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM docs WHERE collection = ? AND id = ?', collection, id);
}

export async function clearCollection(collection: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM docs WHERE collection = ?', collection);
}
