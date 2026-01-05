// Transaction types
export enum TransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum TransactionSource {
  EMAIL = 'email',
  MANUAL = 'manual',
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number; // Amount in paise (integer)
  currency: string;
  type: TransactionType;
  rawMerchant: string;
  cleanMerchant: string;
  categoryId: string | null;
  subcategory: string | null;
  description: string | null;
  transactionDate: Date;
  source: TransactionSource;
  sourceBank: string;
  sourceRef: string | null;
  emailMessageId: string | null;
  rawEmailSubject: string | null;
  confidence: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Category types
export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isSystem: boolean;
  parentId: string | null;
}

// Merchant types
export interface Merchant {
  id: string;
  userId: string;
  rawName: string;
  cleanName: string;
  defaultCategoryId: string | null;
  transactionCount: number;
}

// Settings types
export interface Settings {
  userId: string;
  openaiApiKey: string | null;
  defaultCurrency: string;
  enabledBanks: string[];
  autoSyncOnLoad: boolean;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
}

// Parser types
export interface ParsedTransaction {
  amount: number; // in paise
  type: TransactionType;
  merchant: string;
  date: Date;
  reference: string | null;
  bank: string;
  confidence: number;
}

export interface ParserResult {
  success: boolean;
  transaction: ParsedTransaction | null;
  error: string | null;
  usedLLM?: boolean; // Track if LLM was used for parsing
}

// Sync types
export interface SyncResult {
  success: boolean;
  newTransactions: number;
  duplicates: number;
  errors: number;
  lastSyncAt: string;
}

// Analytics types
export interface SpendingSummary {
  totalSpend: number;
  totalIncome: number;
  netChange: number;
  transactionCount: number;
  byCategory: CategorySpending[];
  byMerchant: MerchantSpending[];
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MerchantSpending {
  merchantName: string;
  amount: number;
  count: number;
}

export interface TrendData {
  date: string;
  amount: number;
  count: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Email types
export interface GmailMessagePart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailMessagePart[];
  };
}

// Bank types
export enum Bank {
  HDFC = 'HDFC',
  SIB = 'SIB',
  ICICI = 'ICICI',
  AXIS = 'AXIS',
  KOTAK = 'KOTAK',
  YES = 'YES',
  UNKNOWN = 'UNKNOWN',
}

export const BANK_SENDERS: Record<Bank, string[]> = {
  [Bank.HDFC]: ['alerts@hdfcbank.net', 'alerts@hdfcbank.com'],
  [Bank.SIB]: ['alerts@sib.co.in', 'noreply@sib.co.in', 'alerts@southindianbank.com'],
  [Bank.ICICI]: ['alerts@icicibank.com', 'creditcard@icicibank.com'],
  [Bank.AXIS]: ['alerts@axisbank.com'],
  [Bank.KOTAK]: ['alerts@kotak.com'],
  [Bank.YES]: ['alerts@yesbank.in'],
  [Bank.UNKNOWN]: [],
};

// Default categories
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Food & Dining', icon: '🍽️', color: '#ef4444', isSystem: true, parentId: null },
  { name: 'Transport', icon: '🚗', color: '#f97316', isSystem: true, parentId: null },
  { name: 'Shopping', icon: '🛒', color: '#eab308', isSystem: true, parentId: null },
  { name: 'Utilities', icon: '💡', color: '#22c55e', isSystem: true, parentId: null },
  { name: 'Entertainment', icon: '🎬', color: '#06b6d4', isSystem: true, parentId: null },
  { name: 'Healthcare', icon: '🏥', color: '#3b82f6', isSystem: true, parentId: null },
  { name: 'Education', icon: '📚', color: '#8b5cf6', isSystem: true, parentId: null },
  { name: 'Travel', icon: '✈️', color: '#ec4899', isSystem: true, parentId: null },
  { name: 'Subscriptions', icon: '📱', color: '#6366f1', isSystem: true, parentId: null },
  { name: 'Transfers', icon: '💸', color: '#64748b', isSystem: true, parentId: null },
  { name: 'Income', icon: '💰', color: '#10b981', isSystem: true, parentId: null },
  { name: 'Other', icon: '📦', color: '#94a3b8', isSystem: true, parentId: null },
];
