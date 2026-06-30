import { LeadSource, LeadStatus, Prisma, SourceCompleteness } from '@prisma/client';

import { findAccountByLabel } from '@/domain/accounts/repository';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
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
};

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
  const subject = decodeHtmlEntities(input.subject);
  const body = decodeHtmlEntities(input.body);

  const evaluation = evaluateEmail({ subject, body, ...evalConfig });

  const status = evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold
    ? LeadStatus.QUALIFIED
    : LeadStatus.NEW;

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
          create: {
            type: 'lead.ingested_from_email',
            payload: { gmailLabel: input.gmailLabel, from: input.from ?? null },
          },
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
