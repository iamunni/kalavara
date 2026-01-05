import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { db, transactions, categories } from '@/lib/db';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const categoryId = searchParams.get('category');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'transactionDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where conditions
    const conditions = [eq(transactions.userId, user.id)];

    if (from) {
      conditions.push(gte(transactions.transactionDate, new Date(from)));
    }

    if (to) {
      conditions.push(lte(transactions.transactionDate, new Date(to)));
    }

    if (categoryId) {
      conditions.push(eq(transactions.categoryId, categoryId));
    }

    if (minAmount) {
      conditions.push(gte(transactions.amount, parseInt(minAmount, 10)));
    }

    if (maxAmount) {
      conditions.push(lte(transactions.amount, parseInt(maxAmount, 10)));
    }

    if (type === 'debit' || type === 'credit') {
      conditions.push(eq(transactions.type, type));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    // Build order clause
    const orderColumn =
      sortBy === 'amount'
        ? transactions.amount
        : sortBy === 'cleanMerchant'
          ? transactions.cleanMerchant
          : transactions.transactionDate;

    const orderClause = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    // Get transactions with category
    const result = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        currency: transactions.currency,
        type: transactions.type,
        rawMerchant: transactions.rawMerchant,
        cleanMerchant: transactions.cleanMerchant,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        subcategory: transactions.subcategory,
        description: transactions.description,
        transactionDate: transactions.transactionDate,
        source: transactions.source,
        sourceBank: transactions.sourceBank,
        sourceRef: transactions.sourceRef,
        confidence: transactions.confidence,
        isVerified: transactions.isVerified,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(orderClause)
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: result,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get transactions' },
      { status: 500 }
    );
  }
}
