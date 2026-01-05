import OpenAI from 'openai';
import { db } from '@/lib/db';

interface CategorizationResult {
  categoryId: string | null;
  cleanMerchant: string;
  subcategory: string | null;
  confidence: number;
}

// Get all categories from database
async function getCategories() {
  return db.query.categories.findMany();
}

// Categorize a transaction using LLM
export async function categorizeTransaction(
  merchant: string,
  amount: number, // in paise
  type: 'debit' | 'credit',
  openaiApiKey?: string
): Promise<CategorizationResult> {
  // Get available categories
  const allCategories = await getCategories();
  const categoryList = allCategories.map((c) => `${c.id}:${c.name}`).join('\n');

  // If no API key, return unknown category
  if (!openaiApiKey) {
    const otherCategory = allCategories.find((c) => c.name === 'Other');
    return {
      categoryId: otherCategory?.id || null,
      cleanMerchant: merchant,
      subcategory: null,
      confidence: 0.3,
    };
  }

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const amountInRupees = (amount / 100).toFixed(2);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a financial transaction categorizer. Given a merchant name and transaction details, determine the category and clean up the merchant name.

Available categories (id:name):
${categoryList}

Return a JSON object with:
- categoryId: the category ID from the list above
- cleanMerchant: a clean, human-readable merchant name (e.g., "Amazon" instead of "AMAZON.IN*MKT")
- subcategory: optional subcategory (e.g., "Groceries" under "Food & Dining", "Fuel" under "Transport")
- confidence: your confidence in the categorization (0-1)

Only return the JSON object, no other text.`,
        },
        {
          role: 'user',
          content: `Merchant: ${merchant}
Amount: ₹${amountInRupees}
Type: ${type}`,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response');
    }

    const parsed = JSON.parse(content) as CategorizationResult;

    // Validate category ID exists
    const validCategory = allCategories.find((c) => c.id === parsed.categoryId);
    if (!validCategory) {
      const otherCategory = allCategories.find((c) => c.name === 'Other');
      parsed.categoryId = otherCategory?.id || null;
      parsed.confidence = Math.min(parsed.confidence, 0.5);
    }

    return {
      categoryId: parsed.categoryId,
      cleanMerchant: parsed.cleanMerchant || merchant,
      subcategory: parsed.subcategory || null,
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error('Categorization error:', error);

    // Fallback to "Other" category
    const otherCategory = allCategories.find((c) => c.name === 'Other');
    return {
      categoryId: otherCategory?.id || null,
      cleanMerchant: merchant,
      subcategory: null,
      confidence: 0.3,
    };
  }
}

// Batch categorize multiple transactions in a SINGLE API call
export async function batchCategorize(
  transactions: Array<{ id: string; merchant: string; amount: number; type: 'debit' | 'credit' }>,
  openaiApiKey?: string
): Promise<Map<string, CategorizationResult>> {
  const allCategories = await getCategories();
  const results = new Map<string, CategorizationResult>();

  // If no API key or no transactions, return defaults
  if (!openaiApiKey || transactions.length === 0) {
    const otherCategory = allCategories.find((c) => c.name === 'Other');
    for (const tx of transactions) {
      results.set(tx.id, {
        categoryId: otherCategory?.id || null,
        cleanMerchant: tx.merchant,
        subcategory: null,
        confidence: 0.3,
      });
    }
    return results;
  }

  const categoryList = allCategories.map((c) => `${c.id}:${c.name}`).join('\n');

  // Process in batches of 100 (safe limit for gpt-4o-mini's 128k context)
  const BATCH_SIZE = 100;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);

    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });

      // Build batch input
      const transactionList = batch.map((tx, idx) =>
        `${idx + 1}. ID: ${tx.id} | Merchant: ${tx.merchant} | Amount: ₹${(tx.amount / 100).toFixed(2)} | Type: ${tx.type}`
      ).join('\n');

      console.log(`Batch categorizing ${batch.length} transactions (batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(transactions.length / BATCH_SIZE)})...`);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a financial transaction categorizer. Given a list of transactions, categorize each one.

Available categories (id:name):
${categoryList}

For each transaction, determine:
- categoryId: the category ID from the list above
- cleanMerchant: ONLY the merchant/business name, cleaned up (e.g., "Amazon" not "AMAZON.IN*MKT", "Zepto" not "ZEPTO MARKETPLACE PRIVATE LIMITED"). Do NOT include subcategory in this field.
- subcategory: optional subcategory as a SEPARATE field (e.g., "Groceries", "Fuel", "Coffee"). Keep this separate from cleanMerchant.
- confidence: your confidence (0-1)

IMPORTANT: cleanMerchant should ONLY contain the merchant name. subcategory is a separate field.

Return a JSON object with a "results" array where each item has: id, categoryId, cleanMerchant, subcategory, confidence.
Example: {"results": [{"id": "abc", "categoryId": "xyz", "cleanMerchant": "Zepto", "subcategory": "Groceries", "confidence": 0.95}]}`,
          },
          {
            role: 'user',
            content: `Categorize these ${batch.length} transactions:\n${transactionList}`,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response');
      }

      const parsed = JSON.parse(content) as { results: Array<{ id: string; categoryId: string; cleanMerchant: string; subcategory?: string; confidence: number }> };

      for (const result of parsed.results) {
        // Validate category ID exists
        const validCategory = allCategories.find((c) => c.id === result.categoryId);
        const otherCategory = allCategories.find((c) => c.name === 'Other');

        results.set(result.id, {
          categoryId: validCategory ? result.categoryId : (otherCategory?.id || null),
          cleanMerchant: result.cleanMerchant || batch.find(t => t.id === result.id)?.merchant || 'Unknown',
          subcategory: result.subcategory || null,
          confidence: validCategory ? (result.confidence || 0.7) : 0.5,
        });
      }

      // Handle any transactions not in response
      for (const tx of batch) {
        if (!results.has(tx.id)) {
          const otherCategory = allCategories.find((c) => c.name === 'Other');
          results.set(tx.id, {
            categoryId: otherCategory?.id || null,
            cleanMerchant: tx.merchant,
            subcategory: null,
            confidence: 0.3,
          });
        }
      }

    } catch (error) {
      console.error('Batch categorization error:', error);

      // Fallback for this batch
      const otherCategory = allCategories.find((c) => c.name === 'Other');
      for (const tx of batch) {
        if (!results.has(tx.id)) {
          results.set(tx.id, {
            categoryId: otherCategory?.id || null,
            cleanMerchant: tx.merchant,
            subcategory: null,
            confidence: 0.3,
          });
        }
      }
    }
  }

  return results;
}
