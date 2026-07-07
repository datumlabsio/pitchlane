/**
 * Import weekly Upwork profile stats from the Google Form CSV export.
 *
 *   npx tsx scripts/import-profile-stats.ts "/path/to/Upwork Profile Stats - Form Responses 1.csv"
 *
 * CSV columns: Timestamp, Week Start date, Week End Date, <profile name>, Profile Views, invites, impressions, clicks
 * Idempotent — upserts on (accountId, weekStart), so re-running overwrites the same weeks.
 */

import { readFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// CSV profile name → DB account personName. See the label evidence:
// "Muhammad Haris Sohail" is the `upwork-alerts-haris` account ("Haris").
const NAME_TO_PERSON: Record<string, string> = {
  'Faizan Khan': 'Faizan Khan',
  'Muhammad Haris Sohail': 'Haris',
  'Nidal Cheema': 'Nidal C',
  'Hadiqa Malik': 'Hadiqa M',
  'Abdur Rehman': 'Abdur Rehman',
  'Humayun Jawad': 'Humayun Jawad',
};

// "6/22/2026" → Date at UTC midnight of 2026-06-22.
function parseUsDate(value: string): Date | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

function num(value: string | undefined): number {
  const n = Number((value ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('Pass the CSV path as the first argument.');

  const rows = readFileSync(path, 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0);
  rows.shift(); // drop header

  const accounts = await prisma.account.findMany({ select: { id: true, personName: true } });
  const idByPerson = new Map(accounts.map((a) => [a.personName, a.id]));

  const perProfile: Record<string, number> = {};
  const unmatchedNames = new Set<string>();
  let imported = 0;
  let skipped = 0;

  for (const line of rows) {
    const c = line.split(',');
    const rawName = (c[3] ?? '').trim();
    const weekStart = parseUsDate(c[1] ?? '');
    if (!rawName || !weekStart) { skipped++; continue; }

    const person = NAME_TO_PERSON[rawName];
    const accountId = person ? idByPerson.get(person) : undefined;
    if (!accountId) { unmatchedNames.add(rawName); skipped++; continue; }

    const data = { views: num(c[4]), invites: num(c[5]), impressions: num(c[6]), clicks: num(c[7]) };
    await prisma.profileStat.upsert({
      where: { accountId_weekStart: { accountId, weekStart } },
      create: { accountId, weekStart, ...data },
      update: data,
    });
    imported++;
    perProfile[person] = (perProfile[person] ?? 0) + 1;
  }

  console.log('Imported rows:', imported);
  console.log('Per profile:', perProfile);
  console.log('Skipped rows:', skipped);
  if (unmatchedNames.size) console.log('UNMATCHED names (not imported):', [...unmatchedNames]);
  const total = await prisma.profileStat.count();
  console.log('ProfileStat total rows now:', total);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
