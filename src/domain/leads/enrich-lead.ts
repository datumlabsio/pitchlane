import { LeadStatus, Prisma, SourceCompleteness } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import { fetchUpworkJob, isScrapeConfigured } from '@/lib/scrape/upwork';

export type EnrichLeadResult =
  | { ok: true; score: number; status: LeadStatus }
  | { ok: false; reason: string };

/**
 * Manually (re-)enrich a lead from its Upwork job URL via the scraper, re-score on
 * the full description, and record a fresh evaluation. Used by the "Re-enrich" button
 * and for leads created while the scraper was unavailable.
 */
export async function enrichLead(leadId: string): Promise<EnrichLeadResult> {
  if (!isScrapeConfigured()) {
    return { ok: false, reason: 'Scraper is not configured (ZENROWS_API_KEY missing).' };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { account: true },
  });
  if (!lead) return { ok: false, reason: 'Lead not found.' };
  if (!lead.sourceUrl) return { ok: false, reason: 'This lead has no Upwork job URL to enrich from.' };

  const profileConfig = await prisma.profileConfig.findFirst({
    where: { accountId: lead.accountId, isActive: true },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  });
  if (!profileConfig) return { ok: false, reason: 'No active profile configuration for this lead.' };

  const enrichment = await fetchUpworkJob(lead.sourceUrl);
  if (!enrichment) {
    return { ok: false, reason: 'The scraper returned no data for this job (it may be closed or blocked).' };
  }

  const enrichedDescription = enrichment.description?.trim();
  const evalBody = enrichedDescription
    ? `${lead.rawEmailBody ?? lead.emailSnippet ?? ''}\n\n${enrichedDescription}`
    : (lead.rawEmailBody ?? lead.emailSnippet ?? lead.title);

  const evaluation = evaluateEmail({
    subject: lead.emailSubject ?? lead.title,
    body: evalBody,
    requiredSkills: profileConfig.requiredSkills,
    niceToHaveSkills: profileConfig.niceToHaveSkills,
    rejectRules: profileConfig.rejectRules,
    targetKeywords: profileConfig.targetKeywords,
    targetRoles: profileConfig.targetRoles,
    budgetPreference: profileConfig.budgetPreference ?? undefined,
    scoringWeights: profileConfig.scoringWeights as { skillMatch?: number; roleFit?: number; keywordMatch?: number; budgetFit?: number; confidence?: number } | null,
  });

  // Only auto-promote a still-NEW lead; never override a human decision.
  const nextStatus =
    lead.status === LeadStatus.NEW && evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold
      ? LeadStatus.QUALIFIED
      : lead.status;

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichment: enrichment as unknown as Prisma.InputJsonValue,
        enrichedAt: new Date(),
        sourceCompleteness: SourceCompleteness.FULL,
        extractedBudget: enrichment.budget || lead.extractedBudget,
        extractedSkills: enrichment.skills?.length ? enrichment.skills : lead.extractedSkills,
        confidence: evaluation.confidence,
        status: nextStatus,
      },
    }),
    prisma.leadEvaluation.create({
      data: {
        leadId,
        profileConfigId: profileConfig.id,
        score: evaluation.score,
        hardFilterPassed: evaluation.hardFilterPassed,
        rejectionReasons: evaluation.rejectionReasons,
        matchedKeywords: evaluation.matchedKeywords,
        summary: evaluation.summary,
        confidence: evaluation.confidence,
      },
    }),
    prisma.leadEvent.create({
      data: {
        leadId,
        type: 'lead.enriched',
        payload: { source: 'scrape', score: evaluation.score, proposalsCount: enrichment.proposalsCount ?? null },
      },
    }),
  ]);

  return { ok: true, score: evaluation.score, status: nextStatus };
}
