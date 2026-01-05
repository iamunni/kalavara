import { ParsedTransaction, TransactionType, Bank, ParserResult } from '@/types';
import { extractAmount } from '@/lib/utils/currency';
import { extractDate } from '@/lib/utils/date';
import { extractEmailText } from '@/lib/utils/html';

// South Indian Bank (SIB) email parser
export function parseSIBEmail(body: string, subject: string, emailDate: Date): ParserResult {
  const text = extractEmailText(body);
  const lowerText = text.toLowerCase();

  try {
    // Determine transaction type
    let type: TransactionType;
    if (
      lowerText.includes('debited') ||
      lowerText.includes('debit') ||
      lowerText.includes('withdrawn') ||
      lowerText.includes('purchase')
    ) {
      type = TransactionType.DEBIT;
    } else if (
      lowerText.includes('credited') ||
      lowerText.includes('credit') ||
      lowerText.includes('received') ||
      lowerText.includes('deposit')
    ) {
      type = TransactionType.CREDIT;
    } else {
      return { success: false, transaction: null, error: 'Could not determine transaction type' };
    }

    // Extract amount
    const amountResult = extractAmount(text);
    if (!amountResult) {
      return { success: false, transaction: null, error: 'Could not extract amount' };
    }

    // Extract date from text or use email date
    const date = extractDate(text) || emailDate;

    // Extract merchant/payee
    let merchant = 'Unknown';
    let reference: string | null = null;

    // Pattern: to/from AccountName or PayeeName
    const toFromMatch = text.match(/(?:to|from|at|by)\s+([A-Za-z0-9\s&.-]+?)(?:\s+on|\s+for|\s+via|\s+through|\s+ref|\n|$)/i);
    if (toFromMatch) {
      merchant = toFromMatch[1].trim();
    }

    // Pattern: UPI transaction
    const upiMatch = text.match(/UPI[:\s]+([^\n\r]+)/i);
    if (upiMatch) {
      const parts = upiMatch[1].split('/');
      if (parts.length > 1) {
        merchant = parts[parts.length - 1].trim();
        reference = `UPI/${parts[0].trim()}`;
      } else {
        merchant = upiMatch[1].trim();
        reference = 'UPI';
      }
    }

    // Pattern: Reference number
    const refMatch = text.match(/(?:ref(?:erence)?|txn|transaction)[:\s#]*([A-Z0-9]+)/i);
    if (refMatch && !reference) {
      reference = refMatch[1];
    }

    // Pattern: IMPS/NEFT
    const impsMatch = text.match(/(IMPS|NEFT)[:\s]*([A-Z0-9]+)?/i);
    if (impsMatch) {
      reference = impsMatch[2] ? `${impsMatch[1]}/${impsMatch[2]}` : impsMatch[1];
    }

    // Clean up merchant name
    merchant = cleanMerchantName(merchant);

    const transaction: ParsedTransaction = {
      amount: amountResult.amount,
      type,
      merchant,
      date,
      reference,
      bank: Bank.SIB,
      confidence: calculateConfidence(amountResult.amount, merchant, date),
    };

    return { success: true, transaction, error: null };
  } catch (error) {
    return {
      success: false,
      transaction: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Clean up merchant name
function cleanMerchantName(name: string): string {
  return name
    .replace(/[*]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(mr|mrs|ms|dr)\.?\s*/i, '')
    .replace(/a\/c\s*\d+/i, '') // Remove account numbers
    .trim()
    .substring(0, 100);
}

// Calculate confidence score
function calculateConfidence(amount: number, merchant: string, date: Date): number {
  let confidence = 0.5;

  if (amount > 0) confidence += 0.2;
  if (merchant !== 'Unknown') confidence += 0.2;

  const daysSinceTransaction = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceTransaction >= 0 && daysSinceTransaction < 365) confidence += 0.1;

  return Math.min(confidence, 1);
}
