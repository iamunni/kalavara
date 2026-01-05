import { ParsedTransaction, TransactionType, Bank, ParserResult } from '@/types';
import { extractEmailText } from '@/lib/utils/html';
import OpenAI from 'openai';

interface LLMParseResult {
  amount: number;
  type: 'debit' | 'credit';
  merchant: string;
  date: string;
  reference: string | null;
}

interface BatchLLMParseResult {
  id: string;
  amount: number;
  type: 'debit' | 'credit';
  merchant: string;
  date: string;
  reference: string | null;
}

// Input for batch parsing
export interface EmailToParse {
  id: string;
  body: string;
  subject: string;
  emailDate: Date;
  bank: Bank;
}

// LLM-based email parser for unknown formats (single email - kept for backwards compatibility)
export async function parseLLMFallback(
  body: string,
  subject: string,
  emailDate: Date,
  bank: Bank,
  openaiApiKey?: string
): Promise<ParserResult> {
  if (!openaiApiKey) {
    return {
      success: false,
      transaction: null,
      error: 'OpenAI API key not configured',
    };
  }

  const text = extractEmailText(body);

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a financial transaction parser. Extract transaction details from bank email notifications.
Return a JSON object with these fields:
- amount: number in rupees (e.g., 1234.56, not paise)
- type: "debit" or "credit"
- merchant: the recipient/sender name (clean, human-readable)
- date: transaction date in YYYY-MM-DD format
- reference: transaction reference/ID if found, null otherwise

Only return the JSON object, no other text.`,
        },
        {
          role: 'user',
          content: `Subject: ${subject}\n\nBody:\n${text.substring(0, 2000)}`,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, transaction: null, error: 'Empty LLM response' };
    }

    const parsed = JSON.parse(content) as LLMParseResult;

    // Validate required fields
    if (!parsed.amount || !parsed.type || !parsed.merchant) {
      return { success: false, transaction: null, error: 'LLM could not extract required fields' };
    }

    // Convert amount to paise
    const amountInPaise = Math.round(parsed.amount * 100);

    // Parse date
    const transactionDate = parsed.date ? new Date(parsed.date) : emailDate;

    const transaction: ParsedTransaction = {
      amount: amountInPaise,
      type: parsed.type === 'debit' ? TransactionType.DEBIT : TransactionType.CREDIT,
      merchant: parsed.merchant,
      date: transactionDate,
      reference: parsed.reference,
      bank,
      confidence: 0.7, // LLM confidence is moderate
    };

    return { success: true, transaction, error: null };
  } catch (error) {
    console.error('LLM parsing error:', error);
    return {
      success: false,
      transaction: null,
      error: error instanceof Error ? error.message : 'LLM parsing failed',
    };
  }
}

// Batch LLM parsing - process multiple emails in a single API call
export async function batchParseLLMFallback(
  emails: EmailToParse[],
  openaiApiKey?: string
): Promise<Map<string, ParserResult>> {
  const results = new Map<string, ParserResult>();

  if (!openaiApiKey || emails.length === 0) {
    for (const email of emails) {
      results.set(email.id, {
        success: false,
        transaction: null,
        error: 'OpenAI API key not configured',
        usedLLM: true,
      });
    }
    return results;
  }

  // Process in batches of 25 (conservative limit given ~800 chars per email body)
  const BATCH_SIZE = 25;

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);

    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });

      // Build batch input - truncate each email body to keep total tokens manageable
      const emailList = batch.map((email, idx) => {
        const text = extractEmailText(email.body).substring(0, 800);
        return `--- Email ${idx + 1} (ID: ${email.id}) ---
Subject: ${email.subject}
Bank: ${email.bank}
Body:
${text}`;
      }).join('\n\n');

      console.log(`Batch LLM parsing ${batch.length} emails (batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(emails.length / BATCH_SIZE)})...`);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a financial transaction parser. Extract transaction details from multiple bank email notifications.

For each email, extract:
- id: the email ID provided
- amount: number in rupees (e.g., 1234.56, not paise)
- type: "debit" or "credit"
- merchant: the recipient/sender name (clean, human-readable). Look for names after "to VPA", "transferred to", "paid to", etc.
- date: transaction date in YYYY-MM-DD format
- reference: transaction reference/ID if found, null otherwise

Return a JSON object with a "results" array containing one object per email.
Example: {"results": [{"id": "abc123", "amount": 500, "type": "debit", "merchant": "John Doe", "date": "2026-01-05", "reference": "UPI123456"}]}`,
          },
          {
            role: 'user',
            content: `Parse these ${batch.length} bank transaction emails:\n\n${emailList}`,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty LLM response');
      }

      const parsed = JSON.parse(content) as { results: BatchLLMParseResult[] };

      // Process each result
      for (const result of parsed.results) {
        const email = batch.find(e => e.id === result.id);
        if (!email) continue;

        if (!result.amount || !result.type || !result.merchant) {
          results.set(result.id, {
            success: false,
            transaction: null,
            error: 'LLM could not extract required fields',
            usedLLM: true,
          });
          continue;
        }

        const amountInPaise = Math.round(result.amount * 100);
        const transactionDate = result.date ? new Date(result.date) : email.emailDate;

        results.set(result.id, {
          success: true,
          transaction: {
            amount: amountInPaise,
            type: result.type === 'debit' ? TransactionType.DEBIT : TransactionType.CREDIT,
            merchant: result.merchant,
            date: transactionDate,
            reference: result.reference,
            bank: email.bank,
            confidence: 0.7,
          },
          error: null,
          usedLLM: true,
        });
      }

      // Handle any emails not in response
      for (const email of batch) {
        if (!results.has(email.id)) {
          results.set(email.id, {
            success: false,
            transaction: null,
            error: 'Email not in LLM response',
            usedLLM: true,
          });
        }
      }

    } catch (error) {
      console.error('Batch LLM parsing error:', error);

      // Mark all emails in this batch as failed
      for (const email of batch) {
        if (!results.has(email.id)) {
          results.set(email.id, {
            success: false,
            transaction: null,
            error: error instanceof Error ? error.message : 'Batch LLM parsing failed',
            usedLLM: true,
          });
        }
      }
    }
  }

  return results;
}
