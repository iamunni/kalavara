import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  googleAccessToken: text('google_access_token'),
  googleRefreshToken: text('google_refresh_token'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Categories table
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  parentId: text('parent_id'),
});

// Transactions table
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // Amount in paise
  currency: text('currency').notNull().default('INR'),
  type: text('type', { enum: ['debit', 'credit'] }).notNull(),
  rawMerchant: text('raw_merchant').notNull(),
  cleanMerchant: text('clean_merchant').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  subcategory: text('subcategory'),
  description: text('description'),
  transactionDate: integer('transaction_date', { mode: 'timestamp' }).notNull(),
  source: text('source', { enum: ['email', 'manual'] }).notNull(),
  sourceBank: text('source_bank').notNull(),
  sourceRef: text('source_ref'),
  emailMessageId: text('email_message_id'),
  rawEmailSubject: text('raw_email_subject'),
  confidence: real('confidence').notNull().default(1.0),
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Merchants table
export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  rawName: text('raw_name').notNull(),
  cleanName: text('clean_name').notNull(),
  defaultCategoryId: text('default_category_id').references(() => categories.id),
  transactionCount: integer('transaction_count').notNull().default(0),
});

// Settings table
export const settings = sqliteTable('settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  openaiApiKey: text('openai_api_key'),
  defaultCurrency: text('default_currency').notNull().default('INR'),
  enabledBanks: text('enabled_banks').notNull().default('[]'), // JSON array
  autoSyncOnLoad: integer('auto_sync_on_load', { mode: 'boolean' }).notNull().default(true),
});

// NextAuth.js required tables
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  sessionToken: text('session_token').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
});

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull().unique(),
  expires: integer('expires', { mode: 'timestamp' }).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  merchants: many(merchants),
  settings: one(settings, {
    fields: [users.id],
    references: [settings.userId],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'parent',
  }),
  children: many(categories, { relationName: 'parent' }),
  transactions: many(transactions),
}));

export const merchantsRelations = relations(merchants, ({ one }) => ({
  user: one(users, {
    fields: [merchants.userId],
    references: [users.id],
  }),
  defaultCategory: one(categories, {
    fields: [merchants.defaultCategoryId],
    references: [categories.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
