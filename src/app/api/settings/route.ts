import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { db, settings } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await requireUser();

    let userSettings = await db.query.settings.findFirst({
      where: eq(settings.userId, user.id),
    });

    // Create default settings if not exist
    if (!userSettings) {
      await db.insert(settings).values({
        userId: user.id,
        defaultCurrency: 'INR',
        enabledBanks: JSON.stringify(['HDFC', 'SIB', 'ICICI', 'AXIS', 'KOTAK', 'YES']),
        autoSyncOnLoad: true,
      });

      userSettings = await db.query.settings.findFirst({
        where: eq(settings.userId, user.id),
      });
    }

    // Don't expose API key in full
    const safeSettings = {
      ...userSettings,
      openaiApiKey: userSettings?.openaiApiKey ? '••••••••' + userSettings.openaiApiKey.slice(-4) : null,
      hasApiKey: !!userSettings?.openaiApiKey,
      enabledBanks: JSON.parse(userSettings?.enabledBanks || '[]'),
    };

    return NextResponse.json({ success: true, data: safeSettings });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    // Get or create settings
    const userSettings = await db.query.settings.findFirst({
      where: eq(settings.userId, user.id),
    });

    const updateData: Partial<typeof userSettings> = {};

    if (body.openaiApiKey !== undefined) {
      // Only update if it's a new key (not the masked version)
      if (body.openaiApiKey && !body.openaiApiKey.startsWith('••••')) {
        updateData.openaiApiKey = body.openaiApiKey;
      }
    }

    if (body.defaultCurrency !== undefined) {
      updateData.defaultCurrency = body.defaultCurrency;
    }

    if (body.enabledBanks !== undefined) {
      updateData.enabledBanks = JSON.stringify(body.enabledBanks);
    }

    if (body.autoSyncOnLoad !== undefined) {
      updateData.autoSyncOnLoad = body.autoSyncOnLoad;
    }

    if (!userSettings) {
      await db.insert(settings).values({
        userId: user.id,
        ...updateData,
        defaultCurrency: updateData.defaultCurrency || 'INR',
        enabledBanks: updateData.enabledBanks || '[]',
        autoSyncOnLoad: updateData.autoSyncOnLoad ?? true,
      });
    } else {
      await db.update(settings).set(updateData).where(eq(settings.userId, user.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
}
