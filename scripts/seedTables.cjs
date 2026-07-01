/**
 * One-time seed: writes Aether Dining's 20 tables into the `Tables` tab of the
 * reservations spreadsheet, and ensures the header row exists.
 *
 * Run from the project root:  node scripts/seedTables.cjs
 *
 * Requires real credentials in .env.local:
 *   GOOGLE_SERVICE_ACCOUNT_JSON (base64 of the service-account key)
 *   GOOGLE_SHEETS_ID
 * and the spreadsheet shared with the service-account email as Editor.
 *
 * Keep the 20-table definition here in sync with lib/restaurant/config.ts (TABLE_SEED).
 */
const fs = require('fs');
const path = require('path');
const { google } = require(path.join(process.cwd(), 'node_modules/googleapis'));

const TAB = 'Tables';
const HEADER = ['TableCode', 'Seats', 'Zone', 'LunchOK', 'DinnerOK'];

const TABLE_SEED = [
  ['AE-T01', 2, 'Standard',   true, true],
  ['AE-T02', 2, 'Standard',   true, true],
  ['AE-T03', 2, 'Standard',   true, true],
  ['AE-T04', 2, 'Standard',   true, true],
  ['AE-T05', 4, 'Standard',   true, true],
  ['AE-T06', 4, 'Standard',   true, true],
  ['AE-T07', 4, 'Standard',   true, true],
  ['AE-T08', 4, 'Standard',   true, true],
  ['AE-T09', 4, 'Standard',   true, true],
  ['AE-T10', 4, 'Standard',   true, true],
  ['AE-T11', 4, 'Standard',   true, true],
  ['AE-T12', 4, 'Standard',   true, true],
  ['AE-T13', 6, 'Standard',   true, true],
  ['AE-T14', 6, 'Standard',   true, true],
  ['AE-T15', 6, 'Standard',   true, true],
  ['AE-T16', 4, 'Patio',      true, true],
  ['AE-T17', 4, 'Patio',      true, true],
  ['AE-T18', 2, 'Bar-Lounge', true, true],
  ['AE-T19', 2, 'Bar-Lounge', true, true],
  ['AE-T20', 4, 'Special',    true, true],
];

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
  const b64 = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = env.GOOGLE_SHEETS_ID;
  if (!b64 || b64.startsWith('your_')) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing/placeholder in .env.local');
  if (!spreadsheetId || spreadsheetId.startsWith('your_')) throw new Error('GOOGLE_SHEETS_ID is missing/placeholder in .env.local');

  const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Ensure the Tables tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const hasTab = (meta.data.sheets || []).some(s => s.properties.title === TAB);
  if (!hasTab) {
    console.log(`Creating tab "${TAB}"...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
    });
  }

  // 2. Overwrite header + 20 rows (idempotent)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A1:E${TABLE_SEED.length + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADER, ...TABLE_SEED] },
  });

  console.log(`Seeded ${TABLE_SEED.length} tables into "${TAB}".`);
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
