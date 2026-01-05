import { ParsedTransaction, TransactionType, Bank, ParserResult } from '@/types';
import { extractAmount } from '@/lib/utils/currency';
import { extractDate } from '@/lib/utils/date';
import { extractEmailText } from '@/lib/utils/html';

// HDFC Bank email parser
export function parseHDFCEmail(body: string, subject: string, emailDate: Date): ParserResult {
  const text = extractEmailText(body);
  const lowerText = text.toLowerCase();

  try {
    // Skip declined/failed transactions
    if (lowerText.includes('was declined') || lowerText.includes('failed') || lowerText.includes('unsuccessful')) {
      return { success: false, transaction: null, error: 'Declined/failed transaction - skipping' };
    }

    // Determine transaction type
    let type: TransactionType;
    if (lowerText.includes('debited') || lowerText.includes('has been debited')) {
      type = TransactionType.DEBIT;
    } else if (lowerText.includes('credited') || lowerText.includes('has been credited') || lowerText.includes('received')) {
      type = TransactionType.CREDIT;
    } else {
      return { success: false, transaction: null, error: 'Could not determine transaction type' };
    }

    // Extract amount - try specific patterns first
    let amount: number | null = null;

    // Pattern: Rs.169.00 or INR 750.00 or Rs 1,234.56
    const amountMatch = text.match(/(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i);
    if (amountMatch) {
      const amountStr = amountMatch[1].replace(/,/g, '');
      amount = Math.round(parseFloat(amountStr) * 100); // Convert to paise
    }

    if (!amount) {
      const amountResult = extractAmount(text);
      if (amountResult) {
        amount = amountResult.amount;
      }
    }

    if (!amount) {
      return { success: false, transaction: null, error: 'Could not extract amount' };
    }

    // Extract date from text or use email date
    const date = extractDate(text) || emailDate;

    // Extract merchant/payee
    let merchant = 'Unknown';
    let reference: string | null = null;

    // Pattern 1: "to upi@address MERCHANT NAME on date"
    // Example: "to pinelabs.10372375@pineaxis ZEPTO MARKETPLACE PRIVATE LIMITED on 04-01-26"
    const upiToMerchantMatch = text.match(/to\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)\s+([A-Z][A-Za-z0-9\s&.,()-]+?)\s+on\s+\d/i);
    if (upiToMerchantMatch) {
      reference = `UPI/${upiToMerchantMatch[1]}`;
      merchant = upiToMerchantMatch[2].trim();
    }

    // Pattern 2: "VPA upi@address (Merchant Name)"
    if (merchant === 'Unknown') {
      const vpaMatch = text.match(/VPA\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)\s*\(([^)]+)\)/i);
      if (vpaMatch) {
        reference = `UPI/${vpaMatch[1]}`;
        merchant = vpaMatch[2].trim();
      }
    }

    // Pattern 3: "Info: UPI/xyz@upi/MerchantName"
    if (merchant === 'Unknown') {
      const upiInfoMatch = text.match(/Info[:\s]+UPI\/([^\/]+)\/([^\n\r]+)/i);
      if (upiInfoMatch) {
        reference = `UPI/${upiInfoMatch[1]}`;
        merchant = upiInfoMatch[2].trim();
      }
    }

    // Pattern 4: "transferred to/from AccountName"
    if (merchant === 'Unknown') {
      const transferMatch = text.match(/(?:transferred|sent|paid)\s+(?:to|from)\s+([^\n\r.]+)/i);
      if (transferMatch) {
        merchant = transferMatch[1].trim();
      }
    }

    // Pattern 5: UPI reference number
    const upiRefMatch = text.match(/UPI\s+(?:transaction\s+)?reference\s+(?:number\s+)?(?:is\s+)?(\d+)/i);
    if (upiRefMatch && !reference) {
      reference = `UPI/${upiRefMatch[1]}`;
    }

    // Pattern 6: NEFT/IMPS reference
    if (!reference) {
      const neftMatch = text.match(/(NEFT|IMPS)[:\s]*([A-Z0-9]+)/i);
      if (neftMatch) {
        reference = `${neftMatch[1]}/${neftMatch[2]}`;
      }
    }

    // Clean up merchant name
    merchant = cleanMerchantName(merchant);

    const transaction: ParsedTransaction = {
      amount,
      type,
      merchant,
      date,
      reference,
      bank: Bank.HDFC,
      confidence: calculateConfidence(amount, merchant, date),
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
    .replace(/[*]+/g, '') // Remove asterisks
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/^(mr|mrs|ms|dr)\.?\s*/i, '') // Remove titles
    .trim()
    .substring(0, 100); // Limit length
}

// Calculate confidence score
function calculateConfidence(amount: number, merchant: string, date: Date): number {
  let confidence = 0.5;

  // Amount extracted successfully
  if (amount > 0) confidence += 0.2;

  // Merchant identified
  if (merchant !== 'Unknown') confidence += 0.2;

  // Date is reasonable (within last year)
  const daysSinceTransaction = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceTransaction >= 0 && daysSinceTransaction < 365) confidence += 0.1;

  return Math.min(confidence, 1);
}
