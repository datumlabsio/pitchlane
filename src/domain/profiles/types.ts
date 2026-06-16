import { ProposalTone } from '@/domain/enums';
import { z } from 'zod';

const stringListField = z.array(z.string().trim().min(1)).max(100);

const scoringWeightsSchema = z.object({
  skillMatch: z.number().min(0).max(1),
  roleFit: z.number().min(0).max(1),
  keywordMatch: z.number().min(0).max(1),
  budgetFit: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
}).optional();

export const profileConfigUpdateSchema = z.object({
  isActive: z.boolean(),
  roleFocus: z.string().trim().min(1, 'Role focus is required').max(160, 'Role focus is too long'),
  jdSummary: z.string().trim().min(1, 'JD summary is required').max(6000, 'JD summary is too long'),
  targetRoles: stringListField,
  targetKeywords: stringListField,
  requiredSkills: stringListField,
  niceToHaveSkills: stringListField,
  rejectRules: stringListField,
  budgetPreference: z.string().trim().max(500),
  scoreThreshold: z.int().min(0, 'Threshold must be at least 0').max(100, 'Threshold cannot exceed 100'),
  proposalTone: z.enum(ProposalTone),
  proposalRules: stringListField,
  reusableSnippets: stringListField,
  scoringWeights: scoringWeightsSchema,
});

export type ProfileConfigUpdateInput = z.infer<typeof profileConfigUpdateSchema>;

export type ScoringWeights = {
  skillMatch: number;
  roleFit: number;
  keywordMatch: number;
  budgetFit: number;
  confidence: number;
};

export type ProfileConfigView = {
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
  budgetPreference: string;
  scoreThreshold: number;
  proposalTone: ProposalTone;
  proposalRules: string[];
  reusableSnippets: string[];
  scoringWeights: ScoringWeights | null;
  updatedAt: string;
};

export type EditableProfileView = {
  account: import('@/domain/accounts/types').AccountSettingsView;
  profileConfig: ProfileConfigView | null;
};

export type ProfileCardView = {
  id: string;
  name: string;
  roleFocus: string;
  label: string;
  threshold: number;
  tone: ProposalTone;
  keywords: string[];
};
