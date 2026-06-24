import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { enrichLead } from '@/domain/leads/enrich-lead';

export type EnrichPendingResult = {
  processed: number;
  enriched: number;
  private: number;
  failed: number;
};

// Leads younger than this are still being handled inline by the sync's after() hook,
// so the safety net leaves them alone to avoid racing / double-enriching.
const INLINE_GRACE_MS = 5 * 60 * 1000;

/**
 * SAFETY NET. Fresh leads are now enriched inline right after ingest (see the Gmail
 * sync route). This sweep only catches stragglers the inline path missed — its
 * after() got cut off, or a fetch failed and should be retried. Bounded per run so
 * the cron stays under maxDuration.
 *
 * Only touches leads with a job URL on active accounts, created between INLINE_GRACE
 * ago and 3 days ago (so it doesn't race the inline path, and doesn't retry
 * permanently-blocked old leads forever). Skips 'private' and 'enriched'.
 */
export async function enrichPendingLeads(limit = 3): Promise<EnrichPendingResult> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days
  const graceCutoff = new Date(Date.now() - INLINE_GRACE_MS); // skip leads still in the inline window

  const leads = await prisma.lead.findMany({
    where: {
      sourceUrl: { not: null },
      createdAt: { gte: cutoff, lte: graceCutoff },
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
