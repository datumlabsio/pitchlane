import { LeadStatus, Prisma, SourceCompleteness } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import { fetchUpworkJob, isScrapeConfigured } from '@/lib/scrape/upwork';
import { generateProposalDraft } from '@/lib/openai/client';
import { notifySlackNewLead } from '@/lib/slack';

export type EnrichLeadResult =
  | { ok: true; outcome: 'enriched'; score: number; status: LeadStatus }
  | { ok: true; outcome: 'private' }
  | { ok: true; outcome: 'failed' }
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

  const outcome = await fetchUpworkJob(lead.sourceUrl);

  // Private or failed: record the status so the UI labels it, then return.
  if (outcome.status !== 'enriched') {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichment: { status: outcome.status } as unknown as Prisma.InputJsonValue,
        enrichedAt: new Date(),
      },
    });
    return { ok: true, outcome: outcome.status };
  }

  const enrichment = outcome.data;
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

  // Regenerate the proposal off the full job description + client facts (the
  // email-only draft made at ingest was thinner).
  const c = enrichment.client;
  const clientSummary = [
    [c.location, c.country].filter(Boolean).join(', '),
    c.totalSpent ? `${c.totalSpent} spent` : null,
    c.totalHires != null ? `${c.totalHires} hires` : null,
    c.paymentVerified ? 'payment verified' : null,
    c.rating != null ? `${c.rating.toFixed(1)}★` : null,
    c.industry || null,
  ].filter(Boolean).join(' · ') || undefined;

  const newProposal = await generateProposalDraft({
    profileName: lead.account.personName,
    roleFocus: profileConfig.roleFocus,
    profileSummary: profileConfig.jdSummary,
    proposalTone: profileConfig.proposalTone,
    proposalRules: profileConfig.proposalRules,
    reusableSnippets: profileConfig.reusableSnippets,
    title: lead.title,
    emailSubject: lead.emailSubject ?? lead.title,
    emailBody: enrichedDescription ?? lead.rawEmailBody ?? lead.title,
    jobBudget: enrichment.budget,
    jobSkills: enrichment.skills,
    proposalsCount: enrichment.proposalsCount,
    clientSummary,
  });

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichment: { status: 'enriched', ...enrichment } as unknown as Prisma.InputJsonValue,
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
    prisma.proposalVersion.updateMany({ where: { leadId, isPrimary: true }, data: { isPrimary: false } }),
    prisma.proposalVersion.create({
      data: { leadId, profileConfigId: profileConfig.id, content: newProposal, isPrimary: true, isAiGenerated: true },
    }),
    prisma.leadEvent.create({
      data: {
        leadId,
        type: 'lead.enriched',
        payload: { source: 'scrape', score: evaluation.score, proposalsCount: enrichment.proposalsCount ?? null },
      },
    }),
  ]);

  // Alert if enrichment pushed a previously-NEW lead over the qualified bar.
  if (lead.status === LeadStatus.NEW && nextStatus === LeadStatus.QUALIFIED) {
    void notifySlackNewLead({
      profileName: lead.account.personName,
      title: lead.title,
      score: evaluation.score,
      budget: enrichment.budget || lead.extractedBudget || 'Unknown',
      leadId,
    });
  }

  return { ok: true, outcome: 'enriched', score: evaluation.score, status: nextStatus };
}
