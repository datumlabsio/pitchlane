import { prisma } from '@/lib/prisma';
import { generateProposalDraft } from '@/lib/openai/client';

export type SaveProposalVersionInput =
  | {
      leadId: string;
      mode: 'edit';
      content: string;
    }
  | {
      leadId: string;
      mode: 'regenerate';
      feedback?: string;
    };

export async function saveProposalVersion(input: SaveProposalVersionInput) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: {
      account: true,
      proposals: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  const profileConfig = await prisma.profileConfig.findFirst({
    where: {
      accountId: lead.accountId,
      isActive: true,
    },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  });

  if (!profileConfig) {
    throw new Error('No active profile configuration found for this lead');
  }

  const currentPrimary = lead.proposals.find((p) => p.isPrimary) ?? lead.proposals[0];

  const content = input.mode === 'edit'
    ? input.content
    : await generateProposalDraft({
        profileName: lead.account.personName,
        roleFocus: profileConfig.roleFocus,
        proposalTone: profileConfig.proposalTone,
        proposalRules: profileConfig.proposalRules,
        reusableSnippets: profileConfig.reusableSnippets,
        title: lead.title,
        emailSubject: lead.emailSubject ?? lead.title,
        emailBody: lead.rawEmailBody ?? lead.emailSnippet ?? lead.title,
        feedback: input.feedback,
        previousProposal: input.feedback ? currentPrimary?.content : undefined,
      });

  return prisma.$transaction(async (tx) => {
    await tx.proposalVersion.updateMany({
      where: {
        leadId: input.leadId,
        isPrimary: true,
      },
      data: {
        isPrimary: false,
      },
    });

    const proposal = await tx.proposalVersion.create({
      data: {
        leadId: input.leadId,
        profileConfigId: profileConfig.id,
        content,
        isPrimary: true,
        isAiGenerated: input.mode === 'regenerate',
      },
    });

    await tx.leadEvent.create({
      data: {
        leadId: input.leadId,
        type: input.mode === 'regenerate' ? 'proposal.regenerated' : 'proposal.edited',
        payload: {
          proposalId: proposal.id,
          versionCount: lead.proposals.length + 1,
        },
      },
    });

    return proposal;
  });
}
