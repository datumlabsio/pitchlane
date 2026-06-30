import { LeadStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { evaluateEmail } from '@/domain/leads/evaluate-email';

export type ReassignResult =
  | { ok: true; unchanged?: boolean; score?: number; status?: LeadStatus; profile?: string }
  | { ok: false; reason: string };

/**
 * Move a lead to a different profile (account) — e.g. a job came in on one profile
 * but you want to apply from another. Re-scores against the NEW profile's config
 * (skills/keywords/rules differ) and clears the old persona's primary proposal so
 * you regenerate a fresh one for the new profile. Human statuses are preserved.
 */
export async function reassignLead(leadId: string, accountId: string): Promise<ReassignResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { account: true } });
  if (!lead) return { ok: false, reason: 'Lead not found.' };
  if (lead.accountId === accountId) return { ok: true, unchanged: true };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || !account.isActive) return { ok: false, reason: 'Target profile not found or inactive.' };

  const cfg = await prisma.profileConfig.findFirst({
    where: { accountId, isActive: true },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  });
  if (!cfg) return { ok: false, reason: 'Target profile has no active configuration.' };

  // Re-score against the new profile, on the best text we have (email + enriched desc).
  const desc = (lead.enrichment as { description?: string } | null)?.description ?? '';
  const body = [lead.rawEmailBody ?? lead.emailSnippet ?? '', desc].filter(Boolean).join('\n\n');
  const ev = evaluateEmail({
    subject: lead.emailSubject ?? lead.title,
    body,
    requiredSkills: cfg.requiredSkills,
    niceToHaveSkills: cfg.niceToHaveSkills,
    rejectRules: cfg.rejectRules,
    targetKeywords: cfg.targetKeywords,
    targetRoles: cfg.targetRoles,
    budgetPreference: cfg.budgetPreference ?? undefined,
    scoringWeights: cfg.scoringWeights as { skillMatch?: number; roleFit?: number; keywordMatch?: number; budgetFit?: number; confidence?: number } | null,
  });

  // Only auto-adjust the screening status; never override a human decision (WON, REJECTED…).
  const nextStatus =
    lead.status === LeadStatus.NEW || lead.status === LeadStatus.QUALIFIED
      ? ev.hardFilterPassed && ev.score >= cfg.scoreThreshold
        ? LeadStatus.QUALIFIED
        : LeadStatus.NEW
      : lead.status;

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { accountId, confidence: ev.confidence, status: nextStatus },
    }),
    prisma.leadEvaluation.create({
      data: {
        leadId,
        profileConfigId: cfg.id,
        score: ev.score,
        hardFilterPassed: ev.hardFilterPassed,
        rejectionReasons: ev.rejectionReasons,
        matchedKeywords: ev.matchedKeywords,
        summary: ev.summary,
        confidence: ev.confidence,
      },
    }),
    // The existing proposal was written for the old persona — demote it so the new
    // profile shows the "generate a proposal" state (old draft stays in history).
    prisma.proposalVersion.updateMany({ where: { leadId, isPrimary: true }, data: { isPrimary: false } }),
    prisma.leadEvent.create({
      data: {
        leadId,
        type: 'lead.reassigned',
        payload: { from: lead.account.personName, to: account.personName, score: ev.score },
      },
    }),
  ]);

  return { ok: true, score: ev.score, status: nextStatus, profile: account.personName };
}
