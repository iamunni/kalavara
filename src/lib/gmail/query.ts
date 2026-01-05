import { Bank, BANK_SENDERS } from '@/types';

// Get all bank sender emails
export function getAllBankSenders(): string[] {
  return Object.values(BANK_SENDERS).flat().filter(Boolean);
}

// Build Gmail query for transaction emails
export function buildTransactionQuery(options: {
  banks?: Bank[];
  since?: Date;
  fullSync?: boolean;
}): string {
  const { banks, since, fullSync } = options;

  // Get sender emails
  let senders: string[];
  if (banks && banks.length > 0) {
    senders = banks.flatMap((bank) => BANK_SENDERS[bank] || []);
  } else {
    senders = getAllBankSenders();
  }

  // Build from query
  const fromQuery = senders.map((s) => `from:${s}`).join(' OR ');

  // Build subject keywords
  const subjectKeywords = [
    'transaction',
    'debit',
    'credit',
    'debited',
    'credited',
    'spent',
    'received',
    'payment',
    'purchase',
    'UPI',
    'NEFT',
    'IMPS',
    'ATM',
    'withdrawal',
  ];
  const subjectQuery = subjectKeywords.map((k) => `subject:${k}`).join(' OR ');

  // Build date filter
  let dateQuery = '';
  if (since) {
    const year = since.getFullYear();
    const month = String(since.getMonth() + 1).padStart(2, '0');
    const day = String(since.getDate()).padStart(2, '0');
    dateQuery = `after:${year}/${month}/${day}`;
  } else if (fullSync) {
    // Default to 6 months for full sync
    dateQuery = 'newer_than:6m';
  } else {
    // Default to 7 days for incremental sync
    dateQuery = 'newer_than:7d';
  }

  // Combine queries
  return `(${fromQuery}) (${subjectQuery}) ${dateQuery}`.trim();
}

// Detect bank from sender email
export function detectBankFromSender(sender: string): Bank {
  const email = sender.toLowerCase();

  for (const [bank, senders] of Object.entries(BANK_SENDERS)) {
    if (senders.some((s) => email.includes(s.toLowerCase()))) {
      return bank as Bank;
    }
  }

  return Bank.UNKNOWN;
}
