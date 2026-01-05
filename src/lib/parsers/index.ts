import { Bank, ParserResult } from '@/types';
import { parseHDFCEmail } from './hdfc';
import { parseSIBEmail } from './sib';
import { parseGenericBankEmail } from './generic';
import { parseLLMFallback } from './llm-fallback';

interface ParseEmailOptions {
  body: string;
  subject: string;
  date: Date;
  bank: Bank;
  openaiApiKey?: string;
}

interface RegexParseOptions {
  body: string;
  subject: string;
  date: Date;
  bank: Bank;
}

// Regex-only parsing (no LLM fallback) - used for first pass in batch processing
export function parseEmailWithRegex(options: RegexParseOptions): ParserResult {
  const { body, subject, date, bank } = options;

  let result: ParserResult;

  switch (bank) {
    case Bank.HDFC:
      result = parseHDFCEmail(body, subject, date);
      break;
    case Bank.SIB:
      result = parseSIBEmail(body, subject, date);
      break;
    default:
      result = parseGenericBankEmail(body, subject, date, bank);
  }

  // Check if regex parsing was successful with valid merchant
  const needsLLM =
    !result.success ||
    (result.transaction && result.transaction.confidence < 0.7) ||
    (result.transaction && result.transaction.merchant === 'Unknown');

  return {
    ...result,
    usedLLM: false,
    // Add flag to indicate if LLM fallback is needed
    needsLLMFallback: needsLLM,
  } as ParserResult & { needsLLMFallback?: boolean };
}

// Main parser orchestrator
export async function parseTransactionEmail(options: ParseEmailOptions): Promise<ParserResult> {
  const { body, subject, date, bank, openaiApiKey } = options;

  // Try bank-specific parser first
  let result: ParserResult;

  switch (bank) {
    case Bank.HDFC:
      result = parseHDFCEmail(body, subject, date);
      if (!result.success) {
        console.log(`HDFC parser failed: ${result.error}`);
      } else {
        console.log(`HDFC parser success: ${result.transaction?.merchant} - ₹${(result.transaction?.amount || 0) / 100}`);
      }
      break;
    case Bank.SIB:
      result = parseSIBEmail(body, subject, date);
      if (!result.success) {
        console.log(`SIB parser failed: ${result.error}`);
      } else {
        console.log(`SIB parser success: ${result.transaction?.merchant} - ₹${(result.transaction?.amount || 0) / 100}`);
      }
      break;
    default:
      // Use generic parser for other banks
      result = parseGenericBankEmail(body, subject, date, bank);
      console.log(`Generic parser for ${bank}: ${result.success ? 'success' : result.error}`);
  }

  // Check if we need LLM fallback:
  // 1. Regex failed completely
  // 2. Low confidence (< 0.7)
  // 3. Merchant is "Unknown" (regex couldn't extract merchant name)
  const needsLLMFallback =
    !result.success ||
    (result.transaction && result.transaction.confidence < 0.7) ||
    (result.transaction && result.transaction.merchant === 'Unknown');

  // If bank-specific parser succeeded with good confidence AND has merchant, return
  if (result.success && result.transaction && result.transaction.confidence >= 0.7 && result.transaction.merchant !== 'Unknown') {
    return { ...result, usedLLM: false };
  }

  // Try LLM fallback
  if (openaiApiKey && needsLLMFallback) {
    const reason = !result.success
      ? 'regex failed'
      : result.transaction?.merchant === 'Unknown'
        ? 'merchant unknown'
        : `low confidence: ${result.transaction?.confidence || 0}`;
    console.log(`Using LLM fallback for parsing (${reason})...`);

    const llmResult = await parseLLMFallback(body, subject, date, bank, openaiApiKey);

    // Return LLM result if it's better
    if (llmResult.success && llmResult.transaction) {
      console.log(`LLM parser success: ${llmResult.transaction.merchant} - ₹${llmResult.transaction.amount / 100}`);
      // If regex parser also had a result, compare
      if (result.success && result.transaction && result.transaction.merchant !== 'Unknown') {
        // Keep regex result if it had higher confidence and valid merchant
        if (result.transaction.confidence > llmResult.transaction.confidence) {
          return { ...result, usedLLM: false };
        }
      }
      return { ...llmResult, usedLLM: true };
    } else {
      console.log(`LLM parser failed: ${llmResult.error}`);
    }
  }

  // Return whatever we got (success or failure)
  return { ...result, usedLLM: false };
}

// Re-export individual parsers for testing
export { parseHDFCEmail } from './hdfc';
export { parseSIBEmail } from './sib';
export { parseGenericBankEmail } from './generic';
export { parseLLMFallback } from './llm-fallback';
