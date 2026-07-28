import { enrichLead } from '@/domain/leads/enrich-lead';

/**
 * Enrich freshly-ingested leads with bounded concurrency. Sequential processing
 * made burst ticks slow — each lead's Slack alert waited behind the previous
 * lead's 20–40s judge call. Three at a time keeps the on-prem model comfortable
 * while cutting the tail latency; failures are swallowed per-lead (the
 * enrich-pending cron sweeps stragglers).
 */
export async function enrichNewLeads(leadIds: string[], concurrency = 3): Promise<void> {
  const queue = [...leadIds];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await enrichLead(id);
      } catch {
        // Best-effort — the safety-net cron retries.
      }
    }
  });
  await Promise.all(workers);
}
