import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { jobCiphertext } from '@/domain/leads/duplicates';
import { scoreLead } from '@/domain/leads/score-lead';

// Only suggest for recent leads — judging the whole backlog against 5 other
// profiles on the on-prem model would take days and help nobody.
const SUGGEST_WINDOW_DAYS = 3;

export type ProfileSuggestion = { accountId: string; profile: string; fitScore: number };

/**
 * Judge one lead against every OTHER active profile and store the ones the judge
 * would qualify, as suggestions ("this job also fits …"). Suggestion only — a human
 * copies via the multi-apply dialog, nothing is auto-created. Built for the Faizan
 * case: his broad alerts catch jobs that really belong to other personas.
 */
export async function suggestProfilesForLead(leadId: string): Promise<ProfileSuggestion[] | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { account: true } });
  if (!lead) return null;

  const accounts = await prisma.account.findMany({
    where: { isActive: true, id: { not: lead.accountId } },
    include: {
      profileConfigs: {
        where: { isActive: true },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
    },
  });

  const cipher = jobCiphertext(lead.sourceUrl);
  const normalizedTitle = lead.title.trim().replace(/\s+/g, ' ').toLowerCase();
  const desc = (lead.enrichment as { description?: string } | null)?.description ?? '';
  const body = [lead.rawEmailBody ?? lead.emailSnippet ?? '', desc].filter(Boolean).join('\n\n');

  const suggestions: ProfileSuggestion[] = [];
  for (const account of accounts) {
    const cfg = account.profileConfigs[0];
    if (!cfg) continue;

    // Skip profiles that already hold this job (their own alert, or an earlier copy)
    // — same matching as the multi-apply copy.
    const existing = await prisma.lead.findFirst({
      where: {
        accountId: account.id,
        OR: [
          ...(cipher ? [{ sourceUrl: { contains: cipher } }] : []),
          { title: { equals: lead.title, mode: 'insensitive' as const } },
        ],
      },
      select: { title: true, sourceUrl: true },
    });
    const alreadyHolds =
      !!existing &&
      (existing.title.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedTitle ||
        Boolean(cipher && existing.sourceUrl?.includes(cipher)));
    if (alreadyHolds) continue;

    // The judge (LiteLLM → Anthropic → rules) against the target profile's brief.
    // Only a clear "qualify" becomes a suggestion — caution noise would train the
    // team to ignore the chips.
    const ev = await scoreLead(cfg, {
      subject: lead.emailSubject ?? lead.title,
      body,
      budget: lead.extractedBudget,
    });
    if (ev.hardFilterPassed) {
      suggestions.push({ accountId: account.id, profile: account.personName, fitScore: ev.score });
    }
  }

  suggestions.sort((a, b) => b.fitScore - a.fitScore);

  // Always write the result — an empty list marks the lead as processed so the
  // sweep doesn't re-judge it every run.
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      profileSuggestions: {
        computedAt: new Date().toISOString(),
        suggestions,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  if (suggestions.length) {
    await prisma.leadEvent.create({
      data: {
        leadId,
        type: 'lead.profiles_suggested',
        payload: {
          profiles: suggestions.map((s) => `${s.profile} (${s.fitScore}%)`),
          actor: 'system',
        },
      },
    });
  }

  return suggestions;
}

/**
 * Sweep recent enriched leads that haven't been checked yet. Small batches: each
 * lead costs up to (active profiles − 1) judge calls at ~20–40s apiece on-prem.
 */
export async function suggestPendingLeads(limit: number) {
  const since = new Date(Date.now() - SUGGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const leads = await prisma.lead.findMany({
    where: {
      enrichedAt: { not: null },
      profileSuggestions: { equals: Prisma.DbNull },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true },
  });

  let processed = 0;
  let suggested = 0;
  for (const l of leads) {
    try {
      const result = await suggestProfilesForLead(l.id);
      processed += 1;
      suggested += result?.length ? 1 : 0;
    } catch {
      // Left unprocessed (profileSuggestions stays null) — the next sweep retries.
    }
  }
  return { picked: leads.length, processed, withSuggestions: suggested };
}
