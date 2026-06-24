import { LeadStatus, Prisma, SourceCompleteness } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import { fetchUpworkJob, isScrapeConfigured, type EnrichOutcome } from '@/lib/scrape/upwork';
import { fetchUpworkJobViaApi, isUpworkApiEnabled } from '@/lib/upwork/api';
import { generateProposalDraft } from '@/lib/ai/proposals';
import { getSlackMinScore } from '@/domain/integrations/repository';
import { notifySlackNewLead } from '@/lib/slack';

// Mirror of the leads-list confidence labelling (0–100 → High/Medium/Low).
function confidenceLabel(c: number): string {
  if (c >= 75) return 'High';
  if (c >= 55) return 'Medium';
  return 'Low';
}

export type EnrichLeadResult =
  | { ok: true; outcome: 'enriched'; score: number; status: LeadStatus }
  | { ok: true; outcome: 'private' }
  | { ok: true; outcome: 'failed' }
  | { ok: false; reason: string };

/**
 * (Re-)enrich a lead from its Upwork job URL — API-first, scraper fallback — re-score
 * on the full description, write a proposal for promising leads, and alert Slack. Runs
 * inline right after ingest, from the safety-net cron, and from the manual Re-enrich
 * button (which passes `force` to bypass the already-enriched guard below).
 */
export async function enrichLead(leadId: string, opts?: { force?: boolean }): Promise<EnrichLeadResult> {
  if (!isUpworkApiEnabled() && !isScrapeConfigured()) {
    return { ok: false, reason: 'No enrichment source configured (Upwork API not connected and scraper disabled).' };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { account: true, evaluations: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!lead) return { ok: false, reason: 'Lead not found.' };
  if (!lead.sourceUrl) return { ok: false, reason: 'This lead has no Upwork job URL to enrich from.' };

  // Idempotency guard: a lead already enriched (or confirmed invite-only) is terminal —
  // skip it unless forced. Stops the inline-ingest path and the safety-net cron from
  // double-enriching / double-alerting the same lead if they ever overlap. 'failed'
  // is NOT terminal, so the cron can still retry blocked fetches.
  const priorStatus = (lead.enrichment as { status?: string } | null)?.status;
  if (!opts?.force && lead.enrichedAt && (priorStatus === 'enriched' || priorStatus === 'private')) {
    return priorStatus === 'enriched'
      ? { ok: true, outcome: 'enriched', score: lead.evaluations[0]?.score ?? 0, status: lead.status }
      : { ok: true, outcome: 'private' };
  }

  const profileConfig = await prisma.profileConfig.findFirst({
    where: { accountId: lead.accountId, isActive: true },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  });
  if (!profileConfig) return { ok: false, reason: 'No active profile configuration for this lead.' };

  const slackMinScore = await getSlackMinScore();
  const freshLead = !lead.enrichedAt && (lead.status === LeadStatus.NEW || lead.status === LeadStatus.QUALIFIED);

  // API-first (fast, official public marketplace search), then fall back to the
  // Bright Data scraper for anything the API can't return (invite-only / closed /
  // not-found-in-search jobs). The scraper is the only path that can detect 'private'.
  let outcome: EnrichOutcome = isUpworkApiEnabled()
    ? await fetchUpworkJobViaApi(lead.sourceUrl)
    : { status: 'failed' };
  if (outcome.status !== 'enriched' && isScrapeConfigured()) {
    outcome = await fetchUpworkJob(lead.sourceUrl);
  }

  // Private or failed: record the status so the UI labels it, then return.
  if (outcome.status !== 'enriched') {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichment: { status: outcome.status } as unknown as Prisma.InputJsonValue,
        enrichedAt: new Date(),
      },
    });
    // Alert on every fresh lead, even when we couldn't fetch the full job — the
    // email-derived meta still tells the user it landed. enrichedAt is set above, so
    // retries won't re-alert (freshLead turns false once it's been attempted).
    const existingScore = lead.evaluations[0]?.score ?? 0;
    if (freshLead) {
      void notifySlackNewLead({
        variant: outcome.status, // 'private' | 'failed'
        profileName: lead.account.personName,
        title: lead.title,
        score: existingScore,
        hot: existingScore >= slackMinScore,
        confidence: confidenceLabel(lead.evaluations[0]?.confidence ?? lead.confidence ?? 0),
        status: lead.status,
        budget: lead.extractedBudget,
        skills: lead.extractedSkills,
        matchedKeywords: lead.evaluations[0]?.matchedKeywords,
        receivedAt: lead.createdAt,
        leadId,
        sourceUrl: lead.sourceUrl,
      });
    }
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

  // Only spend a Claude call on promising leads (the qualify bar) — every lead still
  // alerts and scores, but low-fit ones stay draft-less until you request a proposal
  // in the UI. The manual Re-enrich button (force) always writes one. This also keeps
  // the inline-ingest path fast: most leads skip the slow generation step entirely.
  const shouldWriteProposal =
    Boolean(opts?.force) || (evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold);

  const newProposal = shouldWriteProposal
    ? await generateProposalDraft({
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
      })
    : null;

  const ops: Prisma.PrismaPromise<unknown>[] = [
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
  ];
  if (newProposal) {
    ops.push(
      prisma.proposalVersion.updateMany({ where: { leadId, isPrimary: true }, data: { isPrimary: false } }),
      prisma.proposalVersion.create({
        data: { leadId, profileConfigId: profileConfig.id, content: newProposal, isPrimary: true, isAiGenerated: true },
      }),
    );
  }
  ops.push(
    prisma.leadEvent.create({
      data: {
        leadId,
        type: 'lead.enriched',
        payload: {
          source: enrichment.source ?? 'scrape',
          score: evaluation.score,
          proposalsCount: enrichment.proposalsCount ?? null,
          proposalWritten: Boolean(newProposal),
        },
      },
    }),
  );
  await prisma.$transaction(ops);

  // Rich meta alert on every fresh lead (first enrichment only, so re-enriching is
  // quiet). The dot is 🟢 when the score clears the configured "hot" threshold.
  if (freshLead) {
    const clientLocation = [c.location, c.country].map((s) => s?.trim()).filter(Boolean).join(', ') || null;
    void notifySlackNewLead({
      variant: 'enriched',
      profileName: lead.account.personName,
      title: lead.title,
      score: evaluation.score,
      hot: evaluation.score >= slackMinScore,
      confidence: confidenceLabel(evaluation.confidence),
      status: nextStatus,
      budget: enrichment.budget || lead.extractedBudget,
      paymentType: enrichment.paymentType,
      experienceLevel: enrichment.experienceLevel,
      clientLocation,
      paymentVerified: c.paymentVerified ?? null,
      skills: enrichment.skills?.length ? enrichment.skills : lead.extractedSkills,
      matchedKeywords: evaluation.matchedKeywords,
      proposalsCount: enrichment.proposalsCount ?? null,
      source: enrichment.source ?? null,
      receivedAt: lead.createdAt,
      leadId,
      sourceUrl: lead.sourceUrl,
    });
  }

  return { ok: true, outcome: 'enriched', score: evaluation.score, status: nextStatus };
}
