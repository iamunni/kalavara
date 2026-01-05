import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { db, transactions } from '@/lib/db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { startOfMonth, endOfMonth, subMonths, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    // Parse date range (default to last 3 months)
    const from = searchParams.get('from')
      ? new Date(searchParams.get('from')!)
      : startOfMonth(subMonths(new Date(), 2));
    const to = searchParams.get('to')
      ? new Date(searchParams.get('to')!)
      : endOfMonth(new Date());

    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month

    // Build date format based on grouping
    let dateFormat: string;
    let dateInterval: Date[];

    switch (groupBy) {
      case 'week':
        dateFormat = '%Y-W%W';
        dateInterval = eachWeekOfInterval({ start: from, end: to });
        break;
      case 'month':
        dateFormat = '%Y-%m';
        dateInterval = eachMonthOfInterval({ start: from, end: to });
        break;
      default: // day
        dateFormat = '%Y-%m-%d';
        dateInterval = eachDayOfInterval({ start: from, end: to });
    }

    // Get spending trends
    // Note: Drizzle mode:'timestamp' stores as seconds, not milliseconds
    const trendsResult = await db
      .select({
        date: sql<string>`strftime(${dateFormat}, datetime(${transactions.transactionDate}, 'unixepoch'))`,
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
      .groupBy(sql`strftime(${dateFormat}, datetime(${transactions.transactionDate}, 'unixepoch'))`)
      .orderBy(sql`strftime(${dateFormat}, datetime(${transactions.transactionDate}, 'unixepoch'))`);

    // Create a map for quick lookup
    const trendMap = new Map(trendsResult.map((t) => [t.date, t]));

    // Fill in missing dates with zeros
    const formatString = groupBy === 'week' ? "yyyy-'W'II" : groupBy === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd';
    const data = dateInterval.map((date) => {
      const key = format(date, formatString);
      const existing = trendMap.get(key);
      return {
        date: key,
        amount: existing?.amount || 0,
        count: existing?.count || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      groupBy,
    });
  } catch (error) {
    console.error('Analytics trends error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get trends' },
      { status: 500 }
    );
  }
}
