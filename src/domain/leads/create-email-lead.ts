import { LeadSource, LeadStatus, Prisma, SourceCompleteness } from '@prisma/client';

import { findAccountByLabel } from '@/domain/accounts/repository';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import { jobCiphertext } from '@/domain/leads/duplicates';
import { getActorName } from '@/lib/auth/actor';
import { prisma } from '@/lib/prisma';
import { decodeHtmlEntities } from '@/lib/utils';

export type IngestEmailInput = {
  gmailLabel: string;
  from?: string;
  subject: string;
  body: string;
  source?: LeadSource;
  externalMessageId?: string;
  externalThreadId?: string;
  sourceUrl?: string;
  extractedBudget?: string;
  extractedSkills?: string[];
  sourceCompleteness?: SourceCompleteness;
  /** When the alert email actually arrived (Gmail internalDate). Backfilled mail is
   *  ingested long after arrival — createdAt uses this so lead age reflects the
   *  job's real age (UI relative times, Slack freshness gate, repost window). */
  receivedAt?: Date;
};

// How far back the same-title repost guard looks. Reposts cluster within days or a
// few weeks of the original posting.
const REPOST_WINDOW_DAYS = 45;

function buildDedupeKey(input: IngestEmailInput) {
  if (input.externalMessageId) {
    return `gmail:${input.externalMessageId}`.toLowerCase();
  }

  return `${input.gmailLabel}:${input.subject}:${input.sourceUrl ?? ''}`.toLowerCase();
}

export async function createLeadFromEmail(input: IngestEmailInput) {
  const account = await findAccountByLabel(input.gmailLabel);
  if (!account) {
    throw new Error(`No active account found for label ${input.gmailLabel}`);
  }

  const profileConfig = account.profileConfigs[0];
  if (!profileConfig) {
    throw new Error(`No active profile configuration found for account ${account.name}`);
  }

  const dedupeKey = buildDedupeKey(input);
  const existingLead = await prisma.lead.findUnique({ where: { dedupeKey } });
  if (existingLead) {
    return { lead: existingLead, duplicate: true };
  }

  // Mailbox-agnostic guard: the dedupeKey above is the Gmail message id, which is
  // specific to one inbox — when the same alert lands in (or is re-fetched from) a
  // different mailbox, or Upwork re-alerts the same job, the id differs and the key
  // misses. The job's URL ciphertext is the stable identity, so a lead for the same
  // job on the same profile is always a duplicate regardless of which email it came in.
  const cipher = jobCiphertext(input.sourceUrl);
  if (cipher) {
    const sameJob = await prisma.lead.findFirst({
      where: { accountId: account.id, sourceUrl: { contains: cipher } },
    });
    if (sameJob) {
      return { lead: sameJob, duplicate: true };
    }
  }

  // Repost guard: clients re-list the same job as a brand-new Upwork posting, which
  // gets a fresh job id — so the ciphertext check can't see it. Same profile + same
  // title within the recency window is the same work; skip it. (Window-bound so a
  // genuinely different job that happens to reuse a generic title months later still
  // gets through.)
  const normalizedTitle = decodeHtmlEntities(input.subject).trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalizedTitle) {
    const windowStart = new Date(Date.now() - REPOST_WINDOW_DAYS * 24 * 3600 * 1000);
    const recent = await prisma.lead.findMany({
      where: { accountId: account.id, createdAt: { gte: windowStart } },
      select: { id: true, title: true },
    });
    const samePost = recent.find(
      (l) => l.title.trim().replace(/\s+/g, ' ').toLowerCase() === normalizedTitle,
    );
    if (samePost) {
      const lead = await prisma.lead.findUnique({ where: { id: samePost.id } });
      if (lead) return { lead, duplicate: true };
    }
  }

  const evalConfig = {
    requiredSkills: profileConfig.requiredSkills,
    niceToHaveSkills: profileConfig.niceToHaveSkills,
    rejectRules: profileConfig.rejectRules,
    targetKeywords: profileConfig.targetKeywords,
    targetRoles: profileConfig.targetRoles,
    budgetPreference: profileConfig.budgetPreference ?? undefined,
    scoringWeights: profileConfig.scoringWeights as { skillMatch?: number; roleFit?: number; keywordMatch?: number; budgetFit?: number; confidence?: number } | null,
  };

  // Evaluate from the email only — fast, so ingest never blocks on the ~50s
  // enrichment fetch. The proposal is intentionally NOT generated here: a
  // teaser-email draft is low quality, so we wait for the enrich-pending cron
  // to write it off the full description. Private/failed leads stay draft-less
  // and the UI shows why; the user can still generate from the email manually.
  // Decode HTML entities from the forwarded email ("AI &amp; Automation" → "AI &
  // Automation") so titles, scoring, and Slack all use clean text.
  const subject = decodeHtmlEntities(input.subject).trim();
  const body = decodeHtmlEntities(input.body);

  const evaluation = evaluateEmail({ subject, body, ...evalConfig });

  // Leads WITH a job URL park in NEW only for the seconds until enrichment triages
  // them (the judge resolves every scored lead to QUALIFIED or REJECTED). A lead with
  // NO URL never gets that pass, so triage it here off the email evaluation — nothing
  // is allowed to rot in New.
  const status = evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold
    ? LeadStatus.QUALIFIED
    : !input.sourceUrl
      ? !evaluation.hardFilterPassed && evaluation.rejectionReasons.length > 0
        ? LeadStatus.REJECTED
        : LeadStatus.QUALIFIED
      : LeadStatus.NEW;

  // "system" for the Gmail sync; the person's name for the manual Add-lead dialog.
  const actor = await getActorName();

  let lead;
  try {
    lead = await prisma.lead.create({
      data: {
        accountId: account.id,
        title: subject,
        source: input.source ?? LeadSource.EMAIL_FORWARD,
        externalMessageId: input.externalMessageId,
        externalThreadId: input.externalThreadId,
        sourceUrl: input.sourceUrl,
        sender: input.from,
        emailSubject: subject,
        emailSnippet: body.slice(0, 500),
        rawEmailBody: body,
        extractedBudget: input.extractedBudget,
        extractedSkills: input.extractedSkills ?? [],
        sourceCompleteness: input.sourceCompleteness ?? SourceCompleteness.PARTIAL,
        confidence: evaluation.confidence,
        dedupeKey,
        status,
        ...(input.receivedAt ? { createdAt: input.receivedAt } : {}),
        evaluations: {
          create: {
            profileConfigId: profileConfig.id,
            score: evaluation.score,
            hardFilterPassed: evaluation.hardFilterPassed,
            rejectionReasons: evaluation.rejectionReasons,
            matchedKeywords: evaluation.matchedKeywords,
            summary: evaluation.summary,
            confidence: evaluation.confidence,
          },
        },
        events: {
          create: [
            {
              type: 'lead.ingested_from_email',
              payload: { gmailLabel: input.gmailLabel, from: input.from ?? null, actor },
            },
            // Stage log from birth: record the first transition (null → initial
            // status) so time-in-stage math always has a starting timestamp.
            {
              type: 'lead.status_updated',
              payload: { from: null, to: status, reason: 'ingest', actor },
            },
          ],
        },
      },
      include: { evaluations: true, proposals: true },
    });
  } catch (error) {
    // A concurrent sync raced us to the same dedupeKey — treat as a duplicate.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const dupe = await prisma.lead.findUnique({ where: { dedupeKey } });
      if (dupe) return { lead: dupe, duplicate: true };
    }
    throw error;
  }

  // Slack alerts fire after enrichment (with the full description + proposal +
  // links), not at ingest — see enrichLead. Leads without a job URL won't enrich,
  // so they don't trigger Slack.
  return { lead, duplicate: false };
}
