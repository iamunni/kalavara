import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { fetchTransactionEmails } from '@/lib/gmail/fetch';

// Debug endpoint to inspect raw email content
// Remove this in production!
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    const emails = await fetchTransactionEmails(user.id, {
      fullSync: false,
    });

    // Return first N emails with their raw content
    const samples = emails.slice(0, limit).map((email) => ({
      messageId: email.messageId,
      subject: email.subject,
      sender: email.sender,
      date: email.date,
      bank: email.bank,
      bodyPreview: email.body.substring(0, 2000), // First 2000 chars
    }));

    return NextResponse.json({
      success: true,
      totalEmails: emails.length,
      samples,
    });
  } catch (error) {
    console.error('Debug emails error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
