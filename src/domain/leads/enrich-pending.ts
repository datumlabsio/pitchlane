import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { enrichLead } from '@/domain/leads/enrich-lead';

export type EnrichPendingResult = {
  processed: number;
  enriched: number;
  private: number;
  failed: number;
};

/**
 * Auto-enrich leads that haven't been enriched yet (or whose last attempt
 * failed/was blocked). Bounded per run so the cron stays under maxDuration —
 * each Bright Data unlock takes ~45-60s, so keep `limit` small.
 *
 * Only touches leads with a job URL on active accounts, created recently
 * (so permanently-blocked old leads don't get retried forever). Skips
 * 'private' (unreachable) and 'enriched' (done).
 */
export async function enrichPendingLeads(limit = 3): Promise<EnrichPendingResult> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days

  const leads = await prisma.lead.findMany({
    where: {
      sourceUrl: { not: null },
      createdAt: { gte: cutoff },
      account: { isActive: true },
      OR: [
        { enrichment: { equals: Prisma.DbNull } }, // never attempted
        { enrichment: { path: ['status'], equals: 'failed' } }, // retry blocks
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true },
  });

  const result: EnrichPendingResult = { processed: 0, enriched: 0, private: 0, failed: 0 };
  for (const { id } of leads) {
    const r = await enrichLead(id);
    result.processed += 1;
    if (r.ok && r.outcome === 'enriched') result.enriched += 1;
    else if (r.ok && r.outcome === 'private') result.private += 1;
    else result.failed += 1;
  }
  return result;
}
