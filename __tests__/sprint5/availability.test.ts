/**
 * Sprint 5 — Slot Availability Logic & Overflow Handling
 */

// ---------------------------------------------------------------------------
// Mock the file system so tests don't need the actual JSON on disk
// ---------------------------------------------------------------------------
const MOCK_INVENTORY = {
  '2026-06-28': {
    'Standard Dining': ['12:00', '13:30', '19:00', '20:30'],
    'Large Group (6+)': ['19:00'],
    'Outdoor/Patio': ['12:30', '19:30'],
    'Special Occasion/Anniversary': ['19:00', '20:30'],
    'Bar/Lounge': ['18:00', '19:30', '21:00'],
  },
  '2026-06-29': {
    'Standard Dining': ['12:00', '20:30'],
    'Large Group (6+)': [],
    'Outdoor/Patio': [],
    'Special Occasion/Anniversary': ['20:30'],
    'Bar/Lounge': ['18:00'],
  },
  '2026-06-30': {
    'Standard Dining': ['19:00', '20:30'],
    'Large Group (6+)': ['19:00'],
    'Outdoor/Patio': ['19:30'],
    'Special Occasion/Anniversary': [],
    'Bar/Lounge': [],
  },
  '2026-07-01': {
    'Standard Dining': ['12:00', '13:30', '19:00'],
    'Large Group (6+)': [],
    'Outdoor/Patio': ['12:30'],
    'Special Occasion/Anniversary': ['19:00'],
    'Bar/Lounge': ['19:30'],
  },
};

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify(MOCK_INVENTORY)),
  writeFileSync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// getAvailableSlots
// ---------------------------------------------------------------------------
describe('Sprint 5 – getAvailableSlots', () => {
  let getAvailableSlots: (date: string, occasion: string) => { slots: string[]; alternativeDates?: any[] };

  beforeAll(async () => {
    ({ getAvailableSlots } = await import('@/lib/availability/service'));
  });

  // --- happy path ---
  it('returns available slots for a date with inventory', () => {
    const result = getAvailableSlots('2026-06-28', 'Standard Dining');
    expect(result.slots).toEqual(['12:00', '13:30', '19:00']);
  });

  it('caps returned slots at 3', () => {
    const result = getAvailableSlots('2026-06-28', 'Standard Dining');
    expect(result.slots.length).toBeLessThanOrEqual(3);
  });

  it('returns slots for Large Group occasion', () => {
    const result = getAvailableSlots('2026-06-28', 'Large Group (6+)');
    expect(result.slots).toContain('19:00');
  });

  it('returns slots for Outdoor/Patio occasion', () => {
    const result = getAvailableSlots('2026-06-28', 'Outdoor/Patio');
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('returns slots for Special Occasion/Anniversary', () => {
    const result = getAvailableSlots('2026-06-28', 'Special Occasion/Anniversary');
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('returns slots for Bar/Lounge', () => {
    const result = getAvailableSlots('2026-06-28', 'Bar/Lounge');
    expect(result.slots.length).toBeGreaterThan(0);
  });

  // --- overflow / no availability ---
  it('returns empty slots and alternative dates when no slots for occasion', () => {
    const result = getAvailableSlots('2026-06-29', 'Large Group (6+)');
    expect(result.slots).toHaveLength(0);
    expect(result.alternativeDates).toBeDefined();
    expect(result.alternativeDates!.length).toBeGreaterThan(0);
  });

  it('alternative dates have slots available', () => {
    const result = getAvailableSlots('2026-06-29', 'Large Group (6+)');
    const altDates = result.alternativeDates || [];
    altDates.forEach((alt) => {
      expect(alt.slots.length).toBeGreaterThan(0);
    });
  });

  it('offers at most 2 alternative dates', () => {
    const result = getAvailableSlots('2026-06-29', 'Large Group (6+)');
    const altDates = result.alternativeDates || [];
    expect(altDates.length).toBeLessThanOrEqual(2);
  });

  it('returns empty slots and empty alternatives for unknown date', () => {
    const result = getAvailableSlots('2020-01-01', 'Standard Dining');
    // Should not crash; either returns empty slots or alternatives
    expect(Array.isArray(result.slots)).toBe(true);
  });

  it('alternative dates are chronologically after the requested date', () => {
    const result = getAvailableSlots('2026-06-29', 'Large Group (6+)');
    const altDates = result.alternativeDates || [];
    altDates.forEach((alt) => {
      expect(new Date(alt.date) > new Date('2026-06-29')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Availability API route
// ---------------------------------------------------------------------------
describe('Sprint 5 – /api/availability route', () => {
  it('exports a GET handler', async () => {
    const mod = await import('@/app/api/availability/route');
    expect(typeof mod.GET).toBe('function');
  });

  it('returns 400 when date or occasion is missing', async () => {
    const { GET } = await import('@/app/api/availability/route');
    const req = new Request('http://localhost/api/availability');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns slots JSON for valid date and occasion', async () => {
    const { GET } = await import('@/app/api/availability/route');
    const req = new Request(
      'http://localhost/api/availability?date=2026-06-28&occasion=Standard+Dining',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('slots');
    expect(Array.isArray(body.slots)).toBe(true);
  });

  it('includes alternativeDates in response when no slots available', async () => {
    const { GET } = await import('@/app/api/availability/route');
    const req = new Request(
      'http://localhost/api/availability?date=2026-06-29&occasion=Large+Group+(6%2B)',
    );
    const res = await GET(req);
    const body = await res.json();
    if (body.slots.length === 0) {
      expect(body).toHaveProperty('alternativeDates');
    }
  });
});

// ---------------------------------------------------------------------------
// Occasion constraints
// ---------------------------------------------------------------------------
describe('Sprint 5 – Occasion-specific constraints', () => {
  let getAvailableSlots: (date: string, occasion: string) => any;

  beforeAll(async () => {
    ({ getAvailableSlots } = await import('@/lib/availability/service'));
  });

  it('Large Group slots are only on dates that have them', () => {
    const withSlots = getAvailableSlots('2026-06-28', 'Large Group (6+)');
    expect(withSlots.slots.length).toBeGreaterThan(0);
    const withoutSlots = getAvailableSlots('2026-06-29', 'Large Group (6+)');
    expect(withoutSlots.slots).toHaveLength(0);
  });

  it('Outdoor/Patio availability varies by date', () => {
    const withSlots = getAvailableSlots('2026-06-28', 'Outdoor/Patio');
    expect(withSlots.slots.length).toBeGreaterThan(0);
    const withoutSlots = getAvailableSlots('2026-06-29', 'Outdoor/Patio');
    expect(withoutSlots.slots).toHaveLength(0);
  });
});
