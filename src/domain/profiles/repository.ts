import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { EditableProfileView, ProfileCardView, ProfileConfigUpdateInput, ProfileConfigView, ScoringWeights } from './types';

function mapProfileConfig(profile: {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  roleFocus: string;
  jdSummary: string;
  targetRoles: string[];
  targetKeywords: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  rejectRules: string[];
  budgetPreference: string | null;
  scoreThreshold: number;
  proposalTone: 'CONSULTATIVE' | 'DIRECT' | 'EXPERT' | 'FRIENDLY';
  proposalRules: string[];
  reusableSnippets: string[];
  scoringWeights: Prisma.JsonValue;
  updatedAt: Date;
}): ProfileConfigView {
  return {
    id: profile.id,
    name: profile.name,
    version: profile.version,
    isActive: profile.isActive,
    roleFocus: profile.roleFocus,
    jdSummary: profile.jdSummary,
    targetRoles: profile.targetRoles,
    targetKeywords: profile.targetKeywords,
    requiredSkills: profile.requiredSkills,
    niceToHaveSkills: profile.niceToHaveSkills,
    rejectRules: profile.rejectRules,
    budgetPreference: profile.budgetPreference ?? '',
    scoreThreshold: profile.scoreThreshold,
    proposalTone: profile.proposalTone,
    proposalRules: profile.proposalRules,
    reusableSnippets: profile.reusableSnippets,
    scoringWeights: (profile.scoringWeights as ScoringWeights | null) ?? null,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function listEditableProfiles(): Promise<EditableProfileView[]> {
  const accounts = await prisma.account.findMany({
    include: {
      profileConfigs: {
        orderBy: [{ isActive: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
    },
    orderBy: [{ isActive: 'desc' }, { personName: 'asc' }],
  });

  return accounts.map((account) => ({
    account: {
      id: account.id,
      name: account.name,
      personName: account.personName,
      gmailLabel: account.gmailLabel,
      forwardingInbox: account.forwardingInbox,
      notificationEmail: account.notificationEmail,
      isActive: account.isActive,
    },
    profileConfig: account.profileConfigs[0] ? mapProfileConfig(account.profileConfigs[0]) : null,
  }));
}

export async function listProfileCards(): Promise<ProfileCardView[]> {
  const profiles = await prisma.profileConfig.findMany({
    where: { isActive: true, account: { isActive: true } },
    include: { account: true },
    orderBy: [{ account: { name: 'asc' } }, { version: 'desc' }],
  });

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.account.personName,
    roleFocus: profile.roleFocus,
    label: profile.account.gmailLabel,
    threshold: profile.scoreThreshold,
    tone: profile.proposalTone,
    keywords: profile.targetKeywords.slice(0, 6),
  }));
}

export async function updateProfileConfig(profileConfigId: string, input: ProfileConfigUpdateInput): Promise<ProfileConfigView> {
  try {
    const profile = await prisma.profileConfig.update({
      where: { id: profileConfigId },
      data: {
        isActive: input.isActive,
        roleFocus: input.roleFocus,
        jdSummary: input.jdSummary,
        targetRoles: input.targetRoles,
        targetKeywords: input.targetKeywords,
        requiredSkills: input.requiredSkills,
        niceToHaveSkills: input.niceToHaveSkills,
        rejectRules: input.rejectRules,
        budgetPreference: input.budgetPreference || null,
        scoreThreshold: input.scoreThreshold,
        proposalTone: input.proposalTone,
        proposalRules: input.proposalRules,
        reusableSnippets: input.reusableSnippets,
        ...(input.scoringWeights && { scoringWeights: input.scoringWeights }),
      },
    });

    return mapProfileConfig(profile);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('Profile config not found.');
    }

    throw error;
  }
}
