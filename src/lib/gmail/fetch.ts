import { getGmailClient } from './client';
import { buildTransactionQuery, detectBankFromSender } from './query';
import { Bank, GmailMessage } from '@/types';

interface FetchOptions {
  banks?: Bank[];
  since?: Date;
  fullSync?: boolean;
  maxResults?: number;
}

interface EmailData {
  messageId: string;
  sender: string;
  subject: string;
  body: string;
  date: Date;
  bank: Bank;
}

// Fetch transaction emails from Gmail
export async function fetchTransactionEmails(
  userId: string,
  options: FetchOptions = {}
): Promise<EmailData[]> {
  const gmail = await getGmailClient(userId);
  const query = buildTransactionQuery(options);
  const maxResults = options.maxResults || 500;

  console.log('Gmail query:', query);

  const emails: EmailData[] = [];
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(100, maxResults - emails.length),
      pageToken,
    });

    const messages = response.data.messages || [];

    // Fetch full message details in parallel (batch of 10)
    for (let i = 0; i < messages.length; i += 10) {
      const batch = messages.slice(i, i + 10);
      const details = await Promise.all(
        batch.map((m) =>
          gmail.users.messages.get({
            userId: 'me',
            id: m.id!,
            format: 'full',
          })
        )
      );

      for (const detail of details) {
        const parsed = parseEmailMessage(detail.data as unknown as GmailMessage);
        if (parsed) {
          emails.push(parsed);
        }
      }
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken && emails.length < maxResults);

  console.log(`Fetched ${emails.length} transaction emails`);
  return emails;
}

// Parse a Gmail message into structured data
function parseEmailMessage(message: GmailMessage): EmailData | null {
  try {
    const headers = message.payload.headers;

    const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')?.value || '';
    const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '';
    const dateHeader = headers.find((h) => h.name.toLowerCase() === 'date')?.value;

    // Extract email address from from header
    const emailMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader];
    const sender = emailMatch[1] || fromHeader;

    // Parse date
    const date = dateHeader ? new Date(dateHeader) : new Date(parseInt(message.internalDate));

    // Extract body
    const body = extractBody(message);

    // Detect bank
    const bank = detectBankFromSender(sender);

    return {
      messageId: message.id,
      sender,
      subject,
      body,
      date,
      bank,
    };
  } catch (error) {
    console.error('Error parsing email:', error);
    return null;
  }
}

// Extract text body from email
function extractBody(message: GmailMessage): string {
  // Check direct body
  if (message.payload.body?.data) {
    return decodeBase64(message.payload.body.data);
  }

  // Check parts
  if (message.payload.parts) {
    // Prefer text/plain
    const textPart = message.payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      return decodeBase64(textPart.body.data);
    }

    // Fall back to text/html
    const htmlPart = message.payload.parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) {
      return decodeBase64(htmlPart.body.data);
    }

    // Check nested parts (multipart/alternative inside multipart/mixed)
    for (const part of message.payload.parts) {
      if (part.parts) {
        const nestedText = part.parts.find((p) => p.mimeType === 'text/plain');
        if (nestedText?.body?.data) {
          return decodeBase64(nestedText.body.data);
        }

        const nestedHtml = part.parts.find((p) => p.mimeType === 'text/html');
        if (nestedHtml?.body?.data) {
          return decodeBase64(nestedHtml.body.data);
        }
      }
    }
  }

  // Fall back to snippet
  return message.snippet || '';
}

// Decode base64 encoded string
function decodeBase64(data: string): string {
  // Gmail uses URL-safe base64
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

// Check if an email has already been processed
export async function isEmailProcessed(
  userId: string,
  messageId: string
): Promise<boolean> {
  const { db, transactions } = await import('@/lib/db');
  const { eq, and } = await import('drizzle-orm');

  const existing = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.emailMessageId, messageId)
    ),
  });

  return !!existing;
}
