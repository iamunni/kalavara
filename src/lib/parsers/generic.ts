import { ParsedTransaction, TransactionType, Bank, ParserResult } from '@/types';
import { extractAmount } from '@/lib/utils/currency';
import { extractDate } from '@/lib/utils/date';
import { extractEmailText } from '@/lib/utils/html';

// Generic bank email parser - works for most Indian banks
export function parseGenericBankEmail(
  body: string,
  subject: string,
  emailDate: Date,
  bank: Bank
): ParserResult {
  const text = extractEmailText(body);
  const lowerText = text.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  try {
    // Determine transaction type from text and subject
    let type: TransactionType | null = null;

    // Check text for transaction type
    const debitKeywords = ['debited', 'debit', 'withdrawn', 'spent', 'purchase', 'payment of', 'paid'];
    const creditKeywords = ['credited', 'credit', 'received', 'deposited', 'refund'];

    for (const keyword of debitKeywords) {
      if (lowerText.includes(keyword) || lowerSubject.includes(keyword)) {
        type = TransactionType.DEBIT;
        break;
      }
    }

    if (!type) {
      for (const keyword of creditKeywords) {
        if (lowerText.includes(keyword) || lowerSubject.includes(keyword)) {
          type = TransactionType.CREDIT;
          break;
        }
      }
    }

    if (!type) {
      return { success: false, transaction: null, error: 'Could not determine transaction type' };
    }

    // Extract amount - try multiple patterns
    const amountResult = extractAmount(text) || extractAmount(subject);
    if (!amountResult) {
      return { success: false, transaction: null, error: 'Could not extract amount' };
    }

    // Extract date from text or use email date
    const date = extractDate(text) || emailDate;

    // Extract merchant/payee using various patterns
    let merchant = 'Unknown';
    let reference: string | null = null;

    // Try various merchant extraction patterns
    const merchantPatterns = [
      // UPI patterns
      /UPI[:\-\s]+(?:[^\s\/]+\/)?([^\n\r\/]+?)(?:\s+on|\s+ref|\n|$)/i,
      /VPA[:\s]+([^\n\r]+)/i,
      // At/To patterns
      /(?:at|to|from|paid to|received from)\s+([A-Za-z0-9\s&.,'-]+?)(?:\s+on|\s+via|\s+ref|\s+for|\n|$)/i,
      // Info pattern
      /Info[:\s]+([^\n\r]+)/i,
      // Merchant pattern
      /merchant[:\s]+([^\n\r]+)/i,
      // Payee pattern
      /payee[:\s]+([^\n\r]+)/i,
    ];

    for (const pattern of merchantPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted.length > 2 && extracted.length < 100) {
          merchant = extracted;
          break;
        }
      }
    }

    // Extract reference number
    const refPatterns = [
      /(?:ref(?:erence)?|txn|transaction|rrn)[:\s#]*([A-Z0-9]{6,})/i,
      /UPI[:\s]+([A-Z0-9]+)/i,
      /(IMPS|NEFT|RTGS)[:\s]*([A-Z0-9]+)/i,
    ];

    for (const pattern of refPatterns) {
      const match = text.match(pattern);
      if (match) {
        reference = match[2] ? `${match[1]}/${match[2]}` : match[1];
        break;
      }
    }

    // Clean up merchant name
    merchant = cleanMerchantName(merchant);

    const transaction: ParsedTransaction = {
      amount: amountResult.amount,
      type,
      merchant,
      date,
      reference,
      bank,
      confidence: calculateConfidence(amountResult.amount, merchant, date, text),
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
    .replace(/a\/c\s*[*\d]+/i, '')
    .replace(/\*+\d+/g, '') // Remove masked account numbers
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .substring(0, 100);
}

// Calculate confidence score
function calculateConfidence(amount: number, merchant: string, date: Date, text: string): number {
  let confidence = 0.4; // Lower base for generic parser

  // Amount extracted successfully
  if (amount > 0) confidence += 0.15;

  // Merchant identified
  if (merchant !== 'Unknown' && merchant.length > 3) confidence += 0.2;

  // Date is reasonable
  const daysSinceTransaction = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceTransaction >= 0 && daysSinceTransaction < 365) confidence += 0.1;

  // Text contains typical bank email keywords
  const lowerText = text.toLowerCase();
  const bankKeywords = ['account', 'balance', 'transaction', 'bank'];
  const keywordCount = bankKeywords.filter((k) => lowerText.includes(k)).length;
  confidence += keywordCount * 0.05;

  return Math.min(confidence, 1);
}
