/**
 * Retire FOLLOW_UP / QUALIFIED_LOST / CLOSED from the LeadStatus Postgres enum.
 *
 * Run with:  npx tsx scripts/retire-legacy-statuses.ts
 *
 * Guard (PRD v1.4): aborts if any lead still carries a legacy status.
 * Then recreates the enum without those values. Idempotent when already retired.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LEGACY = ['FOLLOW_UP', 'QUALIFIED_LOST', 'CLOSED'] as const;

async function main() {
  const enumRows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `SELECT e.enumlabel
     FROM pg_enum e
     JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'LeadStatus'
     ORDER BY e.enumsortorder;`,
  );
  const labels = enumRows.map((r) => r.enumlabel);
  const stillPresent = LEGACY.filter((s) => labels.includes(s));

  if (stillPresent.length === 0) {
    console.log('LeadStatus enum already has no legacy values. Nothing to do.');
    return;
  }

  for (const status of LEGACY) {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "Lead" WHERE status::text = $1`,
      status,
    );
    const count = Number(rows[0]?.count ?? 0);
    console.log(`${status}: ${count}`);
    if (count > 0) {
      throw new Error(
        `Abort: ${count} lead(s) still have status ${status}. Migrate them before retiring the enum.`,
      );
    }
  }

  await prisma.$executeRawUnsafe(`
    CREATE TYPE "LeadStatus_new" AS ENUM (
      'NEW',
      'QUALIFIED',
      'REJECTED',
      'APPLIED',
      'CLIENT_REPLIED',
      'INTRO_CALL',
      'ONGOING_DISCUSSION',
      'HIRES_OTHER',
      'JOB_CLOSED',
      'WON',
      'LOST'
    );
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Lead"
      ALTER COLUMN "status" TYPE "LeadStatus_new"
      USING ("status"::text::"LeadStatus_new");
  `);
  await prisma.$executeRawUnsafe(`DROP TYPE "LeadStatus";`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";`);

  console.log('LeadStatus enum retired: removed FOLLOW_UP, QUALIFIED_LOST, CLOSED.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
