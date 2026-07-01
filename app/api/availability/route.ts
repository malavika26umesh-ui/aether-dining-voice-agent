import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/availability/service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const occasion = searchParams.get('occasion');

  if (!date || !occasion) {
    return NextResponse.json({ error: 'date and occasion are required' }, { status: 400 });
  }

  const result = await getAvailableSlots(date, occasion);
  return NextResponse.json(result);
}
