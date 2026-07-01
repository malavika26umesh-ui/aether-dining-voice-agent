import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOccasionConfig, setOccasionConfig } from '@/lib/availability/service';

const OCCASIONS = [
  'Standard Dining',
  'Large Group (6+)',
  'Outdoor/Patio',
  'Special Occasion/Anniversary',
  'Bar/Lounge',
];

/** GET /api/admin/availability — returns [{ occasion, isOpen }] */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getOccasionConfig();
  const result = OCCASIONS.map((occasion) => ({
    occasion,
    isOpen: config[occasion] !== false, // default to true if key missing
  }));

  return NextResponse.json(result);
}

/** PATCH /api/admin/availability — body: { occasion: string, isOpen: boolean } */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { occasion?: string; isOpen?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { occasion, isOpen } = body;
  if (typeof occasion !== 'string' || !OCCASIONS.includes(occasion)) {
    return NextResponse.json({ error: 'Invalid occasion' }, { status: 400 });
  }
  if (typeof isOpen !== 'boolean') {
    return NextResponse.json({ error: 'isOpen must be a boolean' }, { status: 400 });
  }

  const config = getOccasionConfig();
  config[occasion] = isOpen;
  setOccasionConfig(config);

  return NextResponse.json({ occasion, isOpen });
}
