import { prisma } from '@/lib/prisma';
import { getActorName } from '@/lib/auth/actor';
import { generateProposalDraft } from '@/lib/ai/proposals';
import { appendProjectsToSummary, relevantProjectsForJob } from '@/domain/projects/relevant-projects';

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
      /** Portfolio projects to cite. Omitted → auto-pick the most relevant. */
      projectIds?: string[];
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

  // Pull job + client facts from the stored enrichment so manual regenerations
  // use the full description + client context, not just the email.
  const e =
    lead.enrichment && typeof lead.enrichment === 'object' && !Array.isArray(lead.enrichment)
      ? (lead.enrichment as Record<string, unknown>)
      : null;
  const enriched = e?.status === 'enriched';
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  const client =
    e?.client && typeof e.client === 'object' && !Array.isArray(e.client)
      ? (e.client as Record<string, unknown>)
      : {};
  const clientSummary = enriched
    ? [
        [str(client.location), str(client.country)].filter(Boolean).join(', '),
        str(client.totalSpent) ? `${str(client.totalSpent)} spent` : null,
        num(client.totalHires) != null ? `${num(client.totalHires)} hires` : null,
        client.paymentVerified === true ? 'payment verified' : null,
      ].filter(Boolean).join(' · ') || undefined
    : undefined;

  // Portfolio evidence for the draft: explicit picks from the reviewer win; else
  // auto-rank the profile's projects against the job text. Explicit empty array
  // means "cite nothing".
  const jobText = `${lead.title}\n${str(e?.description) ?? lead.rawEmailBody ?? lead.emailSnippet ?? ''}`;
  const portfolioProjects =
    input.mode === 'regenerate'
      ? input.projectIds !== undefined
        ? input.projectIds.length
          ? await prisma.project.findMany({
              where: { id: { in: input.projectIds }, accountId: lead.accountId, isActive: true },
            })
          : []
        : await relevantProjectsForJob(lead.accountId, jobText)
      : [];

  const content = input.mode === 'edit'
    ? input.content
    : await generateProposalDraft({
        profileName: lead.account.personName,
        roleFocus: profileConfig.roleFocus,
        profileSummary: appendProjectsToSummary(profileConfig.jdSummary, portfolioProjects),
        proposalTone: profileConfig.proposalTone,
        proposalRules: profileConfig.proposalRules,
        reusableSnippets: profileConfig.reusableSnippets,
        title: lead.title,
        emailSubject: lead.emailSubject ?? lead.title,
        emailBody: str(e?.description) ?? lead.rawEmailBody ?? lead.emailSnippet ?? lead.title,
        jobBudget: str(e?.budget),
        jobSkills: Array.isArray(e?.skills) ? (e!.skills as unknown[]).map(String) : undefined,
        proposalsCount: num(e?.proposalsCount),
        clientSummary,
        feedback: input.feedback,
        previousProposal: input.feedback ? currentPrimary?.content : undefined,
      });

  const actor = await getActorName();

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
          actor,
          ...(portfolioProjects.length ? { projectsUsed: portfolioProjects.map((p) => p.title) } : {}),
        },
      },
    });

    return proposal;
  });
}
