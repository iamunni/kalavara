import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { db, transactions } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

// Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const transaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    });

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: transaction });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get transaction' },
      { status: 500 }
    );
  }
}

// Update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    // Update allowed fields
    const updateData: Partial<typeof existing> = {
      updatedAt: new Date(),
    };

    if (body.cleanMerchant !== undefined) updateData.cleanMerchant = body.cleanMerchant;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isVerified !== undefined) updateData.isVerified = body.isVerified;

    await db.update(transactions).set(updateData).where(eq(transactions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

// Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Verify ownership
    const existing = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    await db.delete(transactions).where(eq(transactions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
