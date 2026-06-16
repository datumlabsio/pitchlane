import { LeadSource, LeadStatus, SourceCompleteness } from '@prisma/client';

import { findAccountByLabel } from '@/domain/accounts/repository';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import { prisma } from '@/lib/prisma';
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

  const evaluation = evaluateEmail({
    subject: input.subject,
    body: input.body,
    requiredSkills: profileConfig.requiredSkills,
    niceToHaveSkills: profileConfig.niceToHaveSkills,
    rejectRules: profileConfig.rejectRules,
    targetKeywords: profileConfig.targetKeywords,
    targetRoles: profileConfig.targetRoles,
    budgetPreference: profileConfig.budgetPreference ?? undefined,
    scoringWeights: profileConfig.scoringWeights as { skillMatch?: number; roleFit?: number; keywordMatch?: number; budgetFit?: number; confidence?: number } | null,
  });

  const proposal = await generateProposalDraft({
    profileName: account.personName,
    roleFocus: profileConfig.roleFocus,
    proposalTone: profileConfig.proposalTone,
    proposalRules: profileConfig.proposalRules,
    reusableSnippets: profileConfig.reusableSnippets,
    title: input.subject,
    emailSubject: input.subject,
    emailBody: input.body,
  });

  const status = evaluation.hardFilterPassed && evaluation.score >= profileConfig.scoreThreshold
    ? LeadStatus.QUALIFIED
    : LeadStatus.NEW;

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
      proposals: {
        create: {
          profileConfigId: profileConfig.id,
          content: proposal,
          isPrimary: true,
          isAiGenerated: true,
        },
      },
      events: {
        create: {
          type: 'lead.ingested_from_email',
          payload: {
            gmailLabel: input.gmailLabel,
            from: input.from,
          },
        },
      },
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
      budget: input.extractedBudget ?? 'Unknown',
      leadId: lead.id,
    });
  }

  return { lead, duplicate: false };
}
