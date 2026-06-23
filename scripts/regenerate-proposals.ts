/**
 * Backfill: regenerate stale proposals through Claude.
 *
 *   npx tsx scripts/regenerate-proposals.ts           # dry run — list targets
 *   npx tsx scripts/regenerate-proposals.ts --apply   # regenerate via Claude
 *
 * Targets ENRICHED leads whose primary proposal is still the generic template
 * fallback (pre-Anthropic) — detected by the fallback signature (opens "Hi,"
 * and ends with the freelancer's name; real Claude proposals do neither).
 * Uses saveProposalVersion(regenerate), which writes off the full enriched
 * description + client facts + profile config and keeps old versions (the old
 * primary is set non-primary), so this is non-destructive.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}
loadEnvLocal();

async function main() {
  const apply = process.argv.includes('--apply');
  const { prisma } = await import('@/lib/prisma');
  const { saveProposalVersion } = await import('@/domain/leads/save-proposal-version');

  const leads = await prisma.lead.findMany({
    where: { enrichedAt: { not: null } },
    select: {
      id: true,
      title: true,
      account: { select: { personName: true } },
      enrichment: true,
      proposals: { where: { isPrimary: true }, select: { content: true } },
    },
  });

  const enriched = leads.filter((l) => (l.enrichment as { status?: string } | null)?.status === 'enriched');

  const targets = enriched.filter((l) => {
    const content = l.proposals[0]?.content?.trim() ?? '';
    if (!content) return true; // enriched but somehow proposal-less → generate one
    return content.startsWith('Hi,') && content.endsWith(l.account.personName);
  });

  console.log(`Leads enriched: ${enriched.length}`);
  console.log(`Targets (template / empty proposal): ${targets.length}`);
  targets.slice(0, 25).forEach((t) => console.log(`  - ${t.id}  ${t.title.slice(0, 64)}`));
  if (targets.length > 25) console.log(`  … and ${targets.length - 25} more`);

  if (!apply) {
    console.log('\nDRY RUN — re-run with --apply to regenerate through Claude.');
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const t of targets) {
    try {
      await saveProposalVersion({ leadId: t.id, mode: 'regenerate' });
      ok += 1;
      console.log(`✓ ${ok}/${targets.length}  ${t.title.slice(0, 50)}`);
    } catch (e) {
      fail += 1;
      console.log(`✗ ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\nDone. Regenerated ${ok}, failed ${fail}.`);
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
