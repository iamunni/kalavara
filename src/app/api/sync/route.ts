import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { db, transactions, users, settings } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { fetchTransactionEmails, isEmailProcessed } from '@/lib/gmail/fetch';
import { parseEmailWithRegex } from '@/lib/parsers';
import { batchParseLLMFallback, EmailToParse } from '@/lib/parsers/llm-fallback';
import { batchCategorize } from '@/lib/llm/categorize';
import { TransactionSource, ParsedTransaction, Bank } from '@/types';
import { initSyncLog, syncLog, flushSyncLog } from '@/lib/utils/sync-logger';

export async function POST(request: NextRequest) {
  // Initialize sync log (clears previous log file)
  initSyncLog();

  try {
    const user = await requireUser();
    const body = await request.json();
    const fullSync = body.fullSync || false;

    // Get user settings
    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userId, user.id),
    });

    const openaiApiKey = userSettings?.openaiApiKey || process.env.OPENAI_API_KEY;

    // Fetch emails from Gmail
    // - Full sync: last 6 months (ignores lastSyncAt)
    // - Incremental: since lastSyncAt, or last 7 days if never synced
    // Duplicate check (isEmailProcessed) prevents re-processing same emails
    syncLog(`Starting ${fullSync ? 'full' : 'incremental'} sync for user ${user.id}`);
    if (user.lastSyncAt) {
      syncLog(`Last sync: ${user.lastSyncAt.toISOString()}`);
    }

    const emails = await fetchTransactionEmails(user.id, {
      fullSync,
      since: fullSync ? undefined : (user.lastSyncAt ?? undefined),
    });

    let newTransactions = 0;
    let duplicates = 0;
    let errors = 0;
    let regexParsed = 0;
    let llmParsed = 0;

    // Step 1: Parse all emails with regex first (collect parsed transactions and ones needing LLM)
    interface ParsedEmail {
      id: string;
      emailMessageId: string;
      emailSubject: string;
      parsed: ParsedTransaction;
    }
    const parsedEmails: ParsedEmail[] = [];
    const emailsNeedingLLM: Array<{
      id: string;
      email: typeof emails[0];
      regexResult: ParsedTransaction | null;
    }> = [];

    syncLog(`\n--- Pass 1: Regex Parsing ---`);

    for (const email of emails) {
      try {
        syncLog(`Processing email: ${email.messageId} | Subject: ${email.subject} | Bank: ${email.bank}`);

        // Check if already processed
        const alreadyProcessed = await isEmailProcessed(user.id, email.messageId);
        if (alreadyProcessed) {
          syncLog(`  -> Skipping: already processed (duplicate)`);
          duplicates++;
          continue;
        }

        // Try regex parsing first
        const regexResult = parseEmailWithRegex({
          body: email.body,
          subject: email.subject,
          date: email.date,
          bank: email.bank,
        }) as ReturnType<typeof parseEmailWithRegex> & { needsLLMFallback?: boolean };

        if (regexResult.success && regexResult.transaction && !regexResult.needsLLMFallback) {
          // Regex succeeded with good result
          regexParsed++;
          syncLog(`  -> Parsed (regex): ${regexResult.transaction.type} ₹${(regexResult.transaction.amount / 100).toFixed(2)} at ${regexResult.transaction.merchant}`);

          parsedEmails.push({
            id: uuidv4(),
            emailMessageId: email.messageId,
            emailSubject: email.subject,
            parsed: regexResult.transaction,
          });
        } else {
          // Need LLM fallback
          const id = uuidv4();
          const reason = !regexResult.success
            ? 'regex failed'
            : regexResult.transaction?.merchant === 'Unknown'
              ? 'merchant unknown'
              : `low confidence`;
          syncLog(`  -> Needs LLM (${reason})`);

          emailsNeedingLLM.push({
            id,
            email,
            regexResult: regexResult.transaction,
          });
        }
      } catch (error) {
        syncLog(`Error parsing email ${email.messageId}: ${error}`);
        errors++;
      }
    }

    // Step 1b: Batch LLM parse emails that need it
    if (emailsNeedingLLM.length > 0 && openaiApiKey) {
      syncLog(`\n--- Pass 2: Batch LLM Parsing (${emailsNeedingLLM.length} emails) ---`);

      const emailsToParse: EmailToParse[] = emailsNeedingLLM.map((item) => ({
        id: item.id,
        body: item.email.body,
        subject: item.email.subject,
        emailDate: item.email.date,
        bank: item.email.bank as Bank,
      }));

      const llmResults = await batchParseLLMFallback(emailsToParse, openaiApiKey);

      for (const item of emailsNeedingLLM) {
        const llmResult = llmResults.get(item.id);

        if (llmResult?.success && llmResult.transaction) {
          llmParsed++;
          syncLog(`  -> LLM parsed: ${llmResult.transaction.type} ₹${(llmResult.transaction.amount / 100).toFixed(2)} at ${llmResult.transaction.merchant}`);

          parsedEmails.push({
            id: item.id,
            emailMessageId: item.email.messageId,
            emailSubject: item.email.subject,
            parsed: llmResult.transaction,
          });
        } else if (item.regexResult) {
          // LLM failed but regex had partial result - use it
          regexParsed++;
          syncLog(`  -> LLM failed, using regex fallback: ${item.regexResult.merchant}`);

          parsedEmails.push({
            id: item.id,
            emailMessageId: item.email.messageId,
            emailSubject: item.email.subject,
            parsed: item.regexResult,
          });
        } else {
          syncLog(`  -> Failed to parse: ${llmResult?.error || 'Unknown error'}`);
          errors++;
        }
      }
    } else if (emailsNeedingLLM.length > 0) {
      // No API key - use regex results if available
      syncLog(`\n--- No OpenAI API key - using regex results for ${emailsNeedingLLM.length} emails ---`);
      for (const item of emailsNeedingLLM) {
        if (item.regexResult) {
          regexParsed++;
          parsedEmails.push({
            id: item.id,
            emailMessageId: item.email.messageId,
            emailSubject: item.email.subject,
            parsed: item.regexResult,
          });
        } else {
          errors++;
        }
      }
    }

    syncLog(`\n--- Regex: ${regexParsed}, LLM: ${llmParsed}, Errors: ${errors} ---`);

    // Step 2: Batch categorize all parsed transactions in a single API call
    const transactionsToCategize = parsedEmails.map((e) => ({
      id: e.id,
      merchant: e.parsed.merchant,
      amount: e.parsed.amount,
      type: e.parsed.type,
    }));

    syncLog(`Categorizing ${transactionsToCategize.length} transactions...`);
    const categorizationResults = await batchCategorize(transactionsToCategize, openaiApiKey);

    // Step 3: Insert all transactions into database
    const now = new Date();
    for (const email of parsedEmails) {
      try {
        const categorization = categorizationResults.get(email.id) || {
          categoryId: null,
          cleanMerchant: email.parsed.merchant,
          subcategory: null,
          confidence: 0.3,
        };

        // Check for content-based duplicates (same amount, date, merchant within same day)
        const existingByContent = await db.query.transactions.findFirst({
          where: and(
            eq(transactions.userId, user.id),
            eq(transactions.amount, email.parsed.amount),
            eq(transactions.rawMerchant, email.parsed.merchant),
            eq(transactions.transactionDate, email.parsed.date)
          ),
        });

        if (existingByContent) {
          syncLog(`  -> Skipping content duplicate: ${email.parsed.merchant} - ₹${email.parsed.amount / 100}`);
          duplicates++;
          continue;
        }

        await db.insert(transactions).values({
          id: email.id,
          userId: user.id,
          amount: email.parsed.amount,
          currency: 'INR',
          type: email.parsed.type,
          rawMerchant: email.parsed.merchant,
          cleanMerchant: categorization.cleanMerchant,
          categoryId: categorization.categoryId,
          subcategory: categorization.subcategory,
          transactionDate: email.parsed.date,
          source: TransactionSource.EMAIL,
          sourceBank: email.parsed.bank,
          sourceRef: email.parsed.reference,
          emailMessageId: email.emailMessageId,
          rawEmailSubject: email.emailSubject,
          confidence: Math.min(email.parsed.confidence, categorization.confidence),
          isVerified: false,
          createdAt: now,
          updatedAt: now,
        });

        newTransactions++;
      } catch (error) {
        syncLog(`Error saving transaction ${email.id}: ${error}`);
        errors++;
      }
    }

    // Update user's last sync time
    const syncTime = new Date();
    await db.update(users).set({ lastSyncAt: syncTime }).where(eq(users.id, user.id));

    // Log parsing stats summary
    const totalParsed = regexParsed + llmParsed;
    const llmPercentage = totalParsed > 0 ? ((llmParsed / totalParsed) * 100).toFixed(1) : '0';
    syncLog(`\n📊 Sync Stats Summary:`);
    syncLog(`   Total emails fetched: ${emails.length}`);
    syncLog(`   Parsed successfully: ${totalParsed} (regex: ${regexParsed}, LLM: ${llmParsed} = ${llmPercentage}%)`);
    syncLog(`   New transactions: ${newTransactions}`);
    syncLog(`   Duplicates skipped: ${duplicates}`);
    syncLog(`   Errors: ${errors}`);

    // Flush logs to file
    flushSyncLog();

    return NextResponse.json({
      success: true,
      newTransactions,
      duplicates,
      errors,
      totalProcessed: emails.length,
      parsing: {
        regex: regexParsed,
        llm: llmParsed,
        llmPercentage: parseFloat(llmPercentage),
      },
      lastSyncAt: syncTime.toISOString(),
    });
  } catch (error) {
    syncLog(`Sync error: ${error}`);
    flushSyncLog();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await requireUser();

    return NextResponse.json({
      success: true,
      lastSyncAt: user.lastSyncAt?.toISOString() || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      },
      { status: 500 }
    );
  }
}
