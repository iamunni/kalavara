import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { db, transactions, categories } from '@/lib/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    // Parse date range (default to current month)
    const from = searchParams.get('from')
      ? new Date(searchParams.get('from')!)
      : startOfMonth(new Date());
    const to = searchParams.get('to')
      ? new Date(searchParams.get('to')!)
      : endOfMonth(new Date());

    // Get total spend and income
    const totalsResult = await db
      .select({
        type: transactions.type,
        total: sql<number>`sum(${transactions.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.transactionDate, from),
          lte(transactions.transactionDate, to)
        )
      )
      .groupBy(transactions.type);

    const debitTotal = totalsResult.find((t) => t.type === 'debit');
    const creditTotal = totalsResult.find((t) => t.type === 'credit');

    const totalSpend = debitTotal?.total || 0;
    const totalIncome = creditTotal?.total || 0;
    const transactionCount = (debitTotal?.count || 0) + (creditTotal?.count || 0);

    // Get spending by category
    const byCategoryResult = await db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        amount: sql<number>`sum(${transactions.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, 'debit'),
          gte(transactions.transactionDate, from),
          lte(transactions.transactionDate, to)
        )
      )
      .groupBy(transactions.categoryId, categories.name, categories.icon, categories.color)
      .orderBy(sql`sum(${transactions.amount}) desc`);

    const byCategory = byCategoryResult.map((c) => ({
      categoryId: c.categoryId || 'uncategorized',
      categoryName: c.categoryName || 'Uncategorized',
      categoryIcon: c.categoryIcon || '📦',
      categoryColor: c.categoryColor || '#94a3b8',
      amount: c.amount,
      count: c.count,
      percentage: totalSpend > 0 ? Math.round((c.amount / totalSpend) * 100) : 0,
    }));

    // Get top merchants
    const byMerchantResult = await db
      .select({
        merchantName: transactions.cleanMerchant,
        amount: sql<number>`sum(${transactions.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, 'debit'),
          gte(transactions.transactionDate, from),
          lte(transactions.transactionDate, to)
        )
      )
      .groupBy(transactions.cleanMerchant)
      .orderBy(sql`sum(${transactions.amount}) desc`)
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        totalSpend,
        totalIncome,
        netChange: totalIncome - totalSpend,
        transactionCount,
        byCategory,
        byMerchant: byMerchantResult,
        dateRange: { from: from.toISOString(), to: to.toISOString() },
      },
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get analytics' },
      { status: 500 }
    );
  }
}
