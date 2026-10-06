import * as SQLite from 'expo-sqlite';
import { seedFoods } from './seed';

const SCHEMA_VERSION = 7;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('macrofactor.db').then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        onboarded INTEGER NOT NULL DEFAULT 0,
        sex TEXT NOT NULL DEFAULT 'male',
        birth_year INTEGER NOT NULL DEFAULT 1990,
        height_cm REAL NOT NULL DEFAULT 175,
        activity TEXT NOT NULL DEFAULT 'light',
        units TEXT NOT NULL DEFAULT 'metric',
        goal TEXT NOT NULL DEFAULT 'maintain',
        rate_kg_week REAL NOT NULL DEFAULT 0.5,
        protein_g_kg REAL NOT NULL DEFAULT 1.8,
        fat_pct REAL NOT NULL DEFAULT 0.28,
        tdee INTEGER NOT NULL DEFAULT 2200,
        target_kcal INTEGER NOT NULL DEFAULT 2200,
        target_protein INTEGER NOT NULL DEFAULT 140,
        target_carbs INTEGER NOT NULL DEFAULT 250,
        target_fat INTEGER NOT NULL DEFAULT 70,
        program_start TEXT,
        last_checkin TEXT,
        last_expenditure_update TEXT
      );
      INSERT OR IGNORE INTO profile (id) VALUES (1);

      CREATE TABLE IF NOT EXISTS weight_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        weight_kg REAL NOT NULL,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT,
        barcode TEXT UNIQUE,
        source TEXT NOT NULL DEFAULT 'user',
        kcal REAL NOT NULL,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        fiber REAL,
        sugar REAL,
        sodium_mg REAL,
        serving_g REAL,
        serving_name TEXT,
        image_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_used_at TEXT,
        use_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name COLLATE NOCASE);

      CREATE TABLE IF NOT EXISTS food_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        meal TEXT NOT NULL,
        food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        grams REAL NOT NULL,
        kcal REAL NOT NULL,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0,
        fiber REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(date);

      CREATE TABLE IF NOT EXISTS expenditure_history (
        date TEXT PRIMARY KEY,
        tdee INTEGER NOT NULL,
        raw_estimate INTEGER,
        logged_days INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    await db.execAsync('PRAGMA user_version = 1');
  }

  if (version < 2) {
    await db.execAsync(`
      ALTER TABLE foods ADD COLUMN name_en TEXT;
      CREATE INDEX IF NOT EXISTS idx_foods_name_en ON foods(name_en COLLATE NOCASE);
      DELETE FROM foods WHERE source = 'seed';
    `);
    await seedFoods(db);
    await db.execAsync('PRAGMA user_version = 2');
  }

  if (version < 3) {
    await db.execAsync(`
      ALTER TABLE profile ADD COLUMN rate_pct_week REAL NOT NULL DEFAULT 0.5;
      ALTER TABLE profile ADD COLUMN goal_weight_kg REAL;
      PRAGMA user_version = 3;
    `);
  }

  if (version < 4) {
    await db.execAsync(`
      ALTER TABLE profile ADD COLUMN protein_mode TEXT NOT NULL DEFAULT 'auto';
      UPDATE profile SET last_checkin = NULL;
      PRAGMA user_version = 4;
    `);
  }

  if (version < 5) {
    await db.execAsync(`
      ALTER TABLE profile ADD COLUMN program_since TEXT;
      ALTER TABLE profile ADD COLUMN checkin_count INTEGER NOT NULL DEFAULT 0;
      UPDATE profile SET program_since = COALESCE(program_since, program_start);
      PRAGMA user_version = 5;
    `);
  }

  if (version < 6) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        kind TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL
      );
      PRAGMA user_version = 6;
    `);
  }

  if (version < 7) {
    await db.execAsync(`
      ALTER TABLE food_log ADD COLUMN components TEXT;
      PRAGMA user_version = 7;
    `);
  }
}
