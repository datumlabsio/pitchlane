/**
 * Run with:  npx tsx scripts/add-profile-stats-table.ts
 * Creates the ProfileStat table over the pooled connection the app uses
 * (prisma db push hangs against the Supabase pooler). Idempotent.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProfileStat" (
      "id"          TEXT PRIMARY KEY,
      "accountId"   TEXT NOT NULL,
      "weekStart"   DATE NOT NULL,
      "views"       INTEGER NOT NULL DEFAULT 0,
      "invites"     INTEGER NOT NULL DEFAULT 0,
      "impressions" INTEGER NOT NULL DEFAULT 0,
      "clicks"      INTEGER NOT NULL DEFAULT 0,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProfileStat_accountId_fkey" FOREIGN KEY ("accountId")
        REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProfileStat_accountId_weekStart_key" ON "ProfileStat"("accountId", "weekStart");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProfileStat_accountId_weekStart_idx" ON "ProfileStat"("accountId", "weekStart");`,
  );

  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'ProfileStat' ORDER BY column_name;`,
  );
  console.log('ProfileStat columns:', cols);
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
