import { LeadStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getActorName } from '@/lib/auth/actor';
import { jobCiphertext } from '@/domain/leads/duplicates';
import { scoreLead } from '@/domain/leads/score-lead';

export type CopyLeadResult = {
  accountId: string;
  profile: string;
  outcome: 'copied' | 'already_exists' | 'skipped';
  leadId?: string;
  score?: number;
  status?: LeadStatus;
  reason?: string;
};

/**
 * Multi-profile apply: duplicate a lead onto other profiles so several personas can
 * pursue the same job. Each copy is re-scored by the judge against ITS profile's
 * brief and gets its own proposal and lifecycle; copies are linked to the original
 * through the job URL (the "Also matched on N profiles" panel). Profiles that
 * already hold this job are skipped, Slack stays quiet (the job already alerted
 * once), and the original lead is untouched.
 */
export async function copyLeadToAccounts(leadId: string, accountIds: string[]): Promise<CopyLeadResult[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { account: true } });
  if (!lead) throw new Error('Lead not found.');

  const actor = await getActorName();
  const cipher = jobCiphertext(lead.sourceUrl);
  const normalizedTitle = lead.title.trim().replace(/\s+/g, ' ').toLowerCase();
  const results: CopyLeadResult[] = [];

  for (const accountId of accountIds) {
    if (accountId === lead.accountId) continue;

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account || !account.isActive) {
      results.push({ accountId, profile: account?.personName ?? accountId, outcome: 'skipped', reason: 'Profile not found or inactive.' });
      continue;
    }
    const cfg = await prisma.profileConfig.findFirst({
      where: { accountId, isActive: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    if (!cfg) {
      results.push({ accountId, profile: account.personName, outcome: 'skipped', reason: 'No active profile configuration.' });
      continue;
    }

    // The target may already hold this job (its own alert, or an earlier copy).
    const existing = await prisma.lead.findFirst({
      where: {
        accountId,
        OR: [
          ...(cipher ? [{ sourceUrl: { contains: cipher } }] : []),
          { title: { equals: lead.title, mode: 'insensitive' as const } },
        ],
      },
    });
    if (existing && existing.title.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedTitle) {
      results.push({ accountId, profile: account.personName, outcome: 'already_exists', leadId: existing.id, status: existing.status });
      continue;
    }
    if (existing && cipher && existing.sourceUrl?.includes(cipher)) {
      results.push({ accountId, profile: account.personName, outcome: 'already_exists', leadId: existing.id, status: existing.status });
      continue;
    }

    // Judge the job against the TARGET profile — same basis as reassignment.
    const desc = (lead.enrichment as { description?: string } | null)?.description ?? '';
    const body = [lead.rawEmailBody ?? lead.emailSnippet ?? '', desc].filter(Boolean).join('\n\n');
    const ev = await scoreLead(cfg, {
      subject: lead.emailSubject ?? lead.title,
      body,
      budget: lead.extractedBudget,
    });
    const status =
      ev.hardFilterPassed && ev.score >= cfg.scoreThreshold
        ? LeadStatus.QUALIFIED
        : !ev.hardFilterPassed && ev.rejectionReasons.length > 0
          ? LeadStatus.REJECTED
          : LeadStatus.NEW;

    try {
      const copy = await prisma.lead.create({
        data: {
          accountId,
          title: lead.title,
          source: lead.source,
          // Message ids are unique per lead — the copy is a new pursuit, not a new email.
          externalMessageId: null,
          externalThreadId: lead.externalThreadId,
          sourceUrl: lead.sourceUrl,
          sender: lead.sender,
          emailSubject: lead.emailSubject,
          emailSnippet: lead.emailSnippet,
          rawEmailBody: lead.rawEmailBody,
          extractedBudget: lead.extractedBudget,
          extractedSkills: lead.extractedSkills,
          sourceCompleteness: lead.sourceCompleteness,
          enrichment: (lead.enrichment ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          enrichedAt: lead.enrichedAt,
          confidence: ev.confidence,
          dedupeKey: `copy:${lead.id}:${accountId}`.toLowerCase(),
          status,
          evaluations: {
            create: {
              profileConfigId: cfg.id,
              score: ev.score,
              hardFilterPassed: ev.hardFilterPassed,
              rejectionReasons: ev.rejectionReasons,
              matchedKeywords: ev.matchedKeywords,
              summary: ev.summary,
              confidence: ev.confidence,
            },
          },
          events: {
            create: [
              {
                type: 'lead.copied_from_profile',
                payload: { fromProfile: lead.account.personName, fromLeadId: lead.id, actor },
              },
              {
                type: 'lead.status_updated',
                payload: { from: null, to: status, reason: 'multi_profile_apply', actor },
              },
            ],
          },
        },
      });
      results.push({ accountId, profile: account.personName, outcome: 'copied', leadId: copy.id, score: ev.score, status });
    } catch (error) {
      // A concurrent copy raced us — surface the existing one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const dupe = await prisma.lead.findUnique({ where: { dedupeKey: `copy:${lead.id}:${accountId}`.toLowerCase() } });
        if (dupe) {
          results.push({ accountId, profile: account.personName, outcome: 'already_exists', leadId: dupe.id, status: dupe.status });
          continue;
        }
      }
      throw error;
    }
  }

  // Cross-profile note on the source lead so the trail shows the fan-out.
  const copied = results.filter((r) => r.outcome === 'copied');
  if (copied.length) {
    await prisma.leadEvent.create({
      data: {
        leadId,
        type: 'lead.copied_to_profiles',
        payload: { profiles: copied.map((r) => r.profile), actor },
      },
    });
  }

  return results;
}
