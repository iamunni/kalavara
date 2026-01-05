import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { db, transactions, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

// DELETE /api/transactions/clear - Clear all transactions for current user
export async function DELETE() {
  try {
    const user = await requireUser();

    // Clear all transactions
    await db.delete(transactions).where(eq(transactions.userId, user.id));

    // Reset lastSyncAt so next sync fetches all emails again
    await db.update(users).set({ lastSyncAt: null }).where(eq(users.id, user.id));

    console.log(`Cleared transactions and reset lastSyncAt for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'All transactions cleared and sync reset',
    });
  } catch (error) {
    console.error('Clear transactions error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to clear transactions' },
      { status: 500 }
    );
  }
}
