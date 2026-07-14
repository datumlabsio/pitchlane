import { LeadStatus, Prisma, SourceCompleteness } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getActorName } from '@/lib/auth/actor';
import { scoreLead } from '@/domain/leads/score-lead';
import { fetchUpworkJob, isScrapeConfigured, type EnrichOutcome } from '@/lib/scrape/upwork';
import { fetchUpworkJobViaApi, isUpworkApiEnabled } from '@/lib/upwork/api';
import { generateProposalDraft } from '@/lib/ai/proposals';
import { appendProjectsToSummary, relevantProjectsForJob } from '@/domain/projects/relevant-projects';
import { getSlackMinScore } from '@/domain/integrations/repository';
import { findDuplicateSiblings } from '@/domain/leads/duplicates';
import { notifySlackNewLead } from '@/lib/slack';

// Mirror of the leads-list confidence labelling (0–100 → High/Medium/Low).
function confidenceLabel(c: number): string {
  if (c >= 75) return 'High';
  if (c >= 55) return 'Medium';
  return 'Low';
}

// Only Slack-alert leads scoring above this Match % — low-fit leads stay out of
// the channel. The 🟢/⚪ dot (slackMinScore) still flags the strong ones above it.
const SLACK_ALERT_MIN_MATCH = 30;

// Never Slack-alert a job whose alert arrived more than this long ago — speed is
// the whole point of the ping, and backfills/re-syncs ingest days-old mail whose
// jobs are already buried in proposals. (lead.createdAt carries the email's real
// arrival time.)
const SLACK_ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type EnrichLeadResult =
  | { ok: true; outcome: 'enriched'; score: number; status: LeadStatus }
  | { ok: true; outcome: 'private' }
  | { ok: true; outcome: 'failed' }
  | { ok: false; reason: string };

/**
 * (Re-)enrich a lead from its Upwork job URL — API-first, scraper fallback — re-score
 * on the full description, write a proposal for promising leads, and alert Slack. Runs
 * inline right after ingest, from the safety-net cron, and from the manual "Refresh
 * from Upwork" button (which passes `force` to bypass the already-enriched guard below).
 */
export async function enrichLead(leadId: string, opts?: { force?: boolean }): Promise<EnrichLeadResult> {
  if (!isUpworkApiEnabled() && !isScrapeConfigured()) {
    return { ok: false, reason: "Enrichment isn't set up yet — connect Upwork under Settings to fetch job details." };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      account: true,
      evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
      proposals: { select: { id: true }, take: 1 },
    },
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
  const alertAgeOk = Date.now() - lead.createdAt.getTime() <= SLACK_ALERT_MAX_AGE_MS;

  // Cross-account dedupe: if this same Upwork job already produced an alert-worthy
  // lead on another profile, stay quiet here — one job shouldn't ping twice (and
  // shouldn't be pursued by two profiles). The lead panel shows the cross-profile link.
  const siblings = await findDuplicateSiblings({ leadId, sourceUrl: lead.sourceUrl, accountId: lead.accountId });
  const siblingAlreadyAlerted = siblings.some((s) => s.enrichedAt && s.score > SLACK_ALERT_MIN_MATCH && !s.rejected);

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
    const existingRejected = (lead.evaluations[0]?.rejectionReasons?.length ?? 0) > 0;
    if (freshLead && alertAgeOk && existingScore > SLACK_ALERT_MIN_MATCH && !existingRejected && !siblingAlreadyAlerted) {
      void notifySlackNewLead({
        variant: outcome.status, // 'private' | 'failed'
        profileName: lead.account.personName,
        title: lead.title,
        score: existingScore,
        hot: existingScore >= slackMinScore,
        confidence: confidenceLabel(existingScore),
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

  // Client facts — feed the scorer (budget/client viability) and ground the proposal.
  const c = enrichment.client;
  const clientSummary = [
    [c.location, c.country].filter(Boolean).join(', '),
    c.totalSpent ? `${c.totalSpent} spent` : null,
    c.totalHires != null ? `${c.totalHires} hires` : null,
    c.paymentVerified ? 'payment verified' : null,
    c.rating != null ? `${c.rating.toFixed(1)}★` : null,
    c.industry || null,
  ].filter(Boolean).join(' · ') || undefined;

  const evaluation = await scoreLead(profileConfig, {
    subject: lead.emailSubject ?? lead.title,
    body: evalBody,
    budget: enrichment.budget,
    clientSummary,
  });

  // Auto-triage a still-NEW lead from the judge's verdict; never override a human
  // decision. Clear qualify → QUALIFIED. Hard reject (rejection reasons present) →
  // REJECTED, so dead leads don't pile up in New. Caution (failed the bar without
  // hard reasons) stays NEW — that's the "needs a human look" state.
  const nextStatus =
    lead.status === LeadStatus.NEW
      ? evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold
        ? LeadStatus.QUALIFIED
        : !evaluation.hardFilterPassed && evaluation.rejectionReasons.length > 0
          ? LeadStatus.REJECTED
          : lead.status
      : lead.status;

  // Regenerate the proposal off the full job description + client facts (the
  // email-only draft made at ingest was thinner). `c` / `clientSummary` computed above.
  // Write a proposal only when the lead has none yet AND it clears the qualify bar.
  // So: low-fit leads stay draft-less until you ask (in the UI), and a manual "Refresh
  // from Upwork" never clobbers an existing draft — it just refreshes data + re-scores.
  // (force only bypasses the already-enriched guard above, not this.) Keeps the inline
  // path fast too: most leads skip the slow generation step entirely.
  const hasExistingProposal = lead.proposals.length > 0;
  const shouldWriteProposal =
    !hasExistingProposal && evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold;

  // Portfolio evidence: pick the profile's most relevant projects for this job so
  // the draft can cite real work (with links) instead of generic claims.
  const portfolioProjects = shouldWriteProposal
    ? await relevantProjectsForJob(lead.accountId, `${lead.title}\n${evalBody}`)
    : [];

  const newProposal = shouldWriteProposal
    ? await generateProposalDraft({
        profileName: lead.account.personName,
        roleFocus: profileConfig.roleFocus,
        profileSummary: appendProjectsToSummary(profileConfig.jdSummary, portfolioProjects),
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
  // "system" from the crons; the person's name when triggered via Refresh from Upwork.
  const actor = await getActorName();

  // Stage log: enrichment may auto-promote NEW → QUALIFIED; record the transition
  // with its timestamp so time-in-stage reporting sees every hop, not just manual ones.
  if (nextStatus !== lead.status) {
    ops.push(
      prisma.leadEvent.create({
        data: {
          leadId,
          type: 'lead.status_updated',
          payload: { from: lead.status, to: nextStatus, reason: 'enrichment', actor },
        },
      }),
    );
  }
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
          actor,
          ...(newProposal && portfolioProjects.length
            ? { projectsUsed: portfolioProjects.map((p) => p.title) }
            : {}),
        },
      },
    }),
  );
  await prisma.$transaction(ops);

  // Rich meta alert on every fresh lead above the match floor (first enrichment
  // only, so re-enriching is quiet). The dot is 🟢 when the score clears "hot".
  if (freshLead && alertAgeOk && evaluation.score > SLACK_ALERT_MIN_MATCH && evaluation.rejectionReasons.length === 0 && !siblingAlreadyAlerted) {
    const clientLocation = [c.location, c.country].map((s) => s?.trim()).filter(Boolean).join(', ') || null;
    void notifySlackNewLead({
      variant: 'enriched',
      profileName: lead.account.personName,
      title: lead.title,
      score: evaluation.score,
      hot: evaluation.score >= slackMinScore,
      confidence: confidenceLabel(evaluation.score),
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
