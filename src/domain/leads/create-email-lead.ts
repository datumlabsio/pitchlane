import { LeadSource, LeadStatus, Prisma, SourceCompleteness } from '@prisma/client';

import { findAccountByLabel } from '@/domain/accounts/repository';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import { prisma } from '@/lib/prisma';
import { fetchUpworkJob, isApifyConfigured, type JobEnrichment } from '@/lib/apify/client';
import { generateProposalDraft } from '@/lib/openai/client';
import { notifySlackNewLead } from '@/lib/slack';

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

  // Cheap email-only evaluation first — also gates Apify spend: don't enrich
  // jobs that already hit a hard reject rule.
  const emailEval = evaluateEmail({ subject: input.subject, body: input.body, ...evalConfig });

  // Enrich from the full Upwork job page when possible. Any failure (no token,
  // timeout, network error, empty result) leaves enrichment null and we fall
  // back to email-only data below.
  let enrichment: JobEnrichment | null = null;
  if (input.sourceUrl && isApifyConfigured() && emailEval.rejectionReasons.length === 0) {
    enrichment = await fetchUpworkJob(input.sourceUrl);
  }

  const enrichedDescription = enrichment?.description?.trim();
  // Re-score on the richer text when enrichment succeeded.
  const evaluation = enrichedDescription
    ? evaluateEmail({ subject: input.subject, body: `${input.body}\n\n${enrichedDescription}`, ...evalConfig })
    : emailEval;

  const proposalBody = enrichedDescription || input.body;
  const finalBudget = enrichment?.budget || input.extractedBudget;
  const finalSkills = enrichment?.skills?.length ? enrichment.skills : (input.extractedSkills ?? []);
  const completeness = enrichment ? SourceCompleteness.FULL : (input.sourceCompleteness ?? SourceCompleteness.PARTIAL);

  const proposal = await generateProposalDraft({
    profileName: account.personName,
    roleFocus: profileConfig.roleFocus,
    proposalTone: profileConfig.proposalTone,
    proposalRules: profileConfig.proposalRules,
    reusableSnippets: profileConfig.reusableSnippets,
    title: input.subject,
    emailSubject: input.subject,
    emailBody: proposalBody,
  });

  const status = evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold
    ? LeadStatus.QUALIFIED
    : LeadStatus.NEW;

  const events: Prisma.LeadEventCreateWithoutLeadInput[] = [
    {
      type: 'lead.ingested_from_email',
      payload: { gmailLabel: input.gmailLabel, from: input.from ?? null },
    },
  ];
  if (enrichment) {
    events.push({
      type: 'lead.enriched',
      payload: { source: 'apify', proposalsCount: enrichment.proposalsCount ?? null },
    });
  }

  const lead = await prisma.lead.create({
    data: {
      accountId: account.id,
      title: input.subject,
      source: input.source ?? LeadSource.EMAIL_FORWARD,
      externalMessageId: input.externalMessageId,
      externalThreadId: input.externalThreadId,
      sourceUrl: input.sourceUrl,
      sender: input.from,
      emailSubject: input.subject,
      emailSnippet: input.body.slice(0, 500),
      rawEmailBody: input.body,
      extractedBudget: finalBudget,
      extractedSkills: finalSkills,
      sourceCompleteness: completeness,
      enrichment: enrichment ? (enrichment as unknown as Prisma.InputJsonValue) : undefined,
      enrichedAt: enrichment ? new Date() : undefined,
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
      proposals: {
        create: {
          profileConfigId: profileConfig.id,
          content: proposal,
          isPrimary: true,
          isAiGenerated: true,
        },
      },
      events: { create: events },
    },
    include: {
      evaluations: true,
      proposals: true,
    },
  });

  if (status === LeadStatus.QUALIFIED) {
    void notifySlackNewLead({
      profileName: account.personName,
      title: input.subject,
      score: evaluation.score,
      budget: finalBudget ?? 'Unknown',
      leadId: lead.id,
    });
  }

  return { lead, duplicate: false };
}
