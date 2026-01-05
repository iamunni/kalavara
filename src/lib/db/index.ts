import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_CATEGORIES } from '@/types';

const DATABASE_PATH = process.env.DATABASE_URL || './data/expense-tracker.db';

// Lazy database connection - only create when actually needed
let _db: BetterSQLite3Database<typeof schema> | null = null;
let _sqlite: Database.Database | null = null;

function getSqlite(): Database.Database {
  if (!_sqlite) {
    _sqlite = new Database(DATABASE_PATH);
    _sqlite.pragma('journal_mode = WAL');
  }
  return _sqlite;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    _db = drizzle(getSqlite(), { schema });
  }
  return _db;
}

// Export db as a getter that lazily initializes
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string];
  },
});

// Initialize database with tables and seed data
export async function initializeDatabase() {
  const sqlite = getSqlite();

  // Create tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image TEXT,
      google_access_token TEXT,
      google_refresh_token TEXT,
      last_sync_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
      raw_merchant TEXT NOT NULL,
      clean_merchant TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id),
      subcategory TEXT,
      description TEXT,
      transaction_date INTEGER NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('email', 'manual')),
      source_bank TEXT NOT NULL,
      source_ref TEXT,
      email_message_id TEXT,
      raw_email_subject TEXT,
      confidence REAL NOT NULL DEFAULT 1.0,
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      raw_name TEXT NOT NULL,
      clean_name TEXT NOT NULL,
      default_category_id TEXT REFERENCES categories(id),
      transaction_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      openai_api_key TEXT,
      default_currency TEXT NOT NULL DEFAULT 'INR',
      enabled_banks TEXT NOT NULL DEFAULT '[]',
      auto_sync_on_load INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_email_id ON transactions(email_message_id);
    CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants(user_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
  `);

  // Seed default categories if not exist
  const existingCategories = sqlite.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };

  if (existingCategories.count === 0) {
    const insertCategory = sqlite.prepare(
      'INSERT INTO categories (id, name, icon, color, is_system, parent_id) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (const category of DEFAULT_CATEGORIES) {
      insertCategory.run(
        uuidv4(),
        category.name,
        category.icon,
        category.color,
        category.isSystem ? 1 : 0,
        category.parentId
      );
    }

    console.log('✅ Seeded default categories');
  }

  console.log('✅ Database initialized');
}

// Export schema for use in queries
export * from './schema';
