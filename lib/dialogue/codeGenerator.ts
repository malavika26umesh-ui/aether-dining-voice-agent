let lastResetDate = '';
let currentCounter = 0;

/**
 * Generates a unique Reservation Code: TABLE-[A-Z][0-9][0-9]
 * Excludes letters I and O.
 * Uses an in-memory daily counter that resets at midnight IST.
 */
export function generateReservationCode(): string {
  const now = new Date();
  // Convert to IST (UTC +5:30)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istTime = new Date(utc + 3600000 * 5.5);

  const yyyy = istTime.getFullYear();
  const mm = String(istTime.getMonth() + 1).padStart(2, '0');
  const dd = String(istTime.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  if (dateStr !== lastResetDate) {
    lastResetDate = dateStr;
    currentCounter = 0;
  }

  const counterStr = String(currentCounter).padStart(2, '0');
  currentCounter = (currentCounter + 1) % 100;

  // Alphabet excluding I and O
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];

  return `TABLE-${randomLetter}${counterStr}`;
}
