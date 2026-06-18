/**
 * Run with:  npx tsx scripts/add-enrichment-columns.ts
 * Adds the additive, nullable enrichment columns to the Lead table over the
 * pooled connection the app uses. Idempotent (IF NOT EXISTS).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enrichment" JSONB;');
  await prisma.$executeRawUnsafe('ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enrichedAt" TIMESTAMP(3);');

  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Lead' AND column_name IN ('enrichment', 'enrichedAt') ORDER BY column_name;`,
  );
  console.log('Verified columns:', cols);
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
