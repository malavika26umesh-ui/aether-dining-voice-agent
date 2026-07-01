import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAllReservations } from '@/lib/mcp/sheets';

export async function GET(req: NextRequest) {
  // Require authenticated session
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateFilter = searchParams.get('date') || undefined;

  try {
    const records = await getAllReservations(dateFilter);
    return NextResponse.json(records);
  } catch (error: any) {
    // Graceful degradation: if Sheets credentials aren't configured, return empty
    if (error.message?.includes('Missing GOOGLE_SHEETS_ID') ||
        error.message?.includes('GOOGLE_SERVICE_ACCOUNT_JSON')) {
      return NextResponse.json([]);
    }
    console.error('Admin reservations fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
