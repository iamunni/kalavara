import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const allCategories = await db.query.categories.findMany({
      orderBy: (categories, { asc }) => [asc(categories.name)],
    });

    return NextResponse.json({
      success: true,
      data: allCategories,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get categories' },
      { status: 500 }
    );
  }
}
