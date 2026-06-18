import type { LeadStatus } from '@prisma/client';

export const leadLifecycleStatuses = [
  'QUALIFIED',
  'REJECTED',
  'APPLIED',
  'CLIENT_REPLIED',
  'INTRO_CALL',
  'ONGOING_DISCUSSION',
  'FOLLOW_UP',
  'HIRES_OTHER',
  'QUALIFIED_LOST',
  'JOB_CLOSED',
  'WON',
  'LOST',
  'CLOSED',
] as const satisfies readonly LeadStatus[];

export const leadStatusLabelMap: Record<LeadStatus, string> = {
  NEW: 'New',
  QUALIFIED: 'Qualified',
  REJECTED: 'Rejected',
  APPLIED: 'Applied',
  CLIENT_REPLIED: 'Client Replied',
  INTRO_CALL: 'Intro Call',
  FOLLOW_UP: 'Follow Up',
  ONGOING_DISCUSSION: 'Ongoing Discussion',
  HIRES_OTHER: 'Hired Other',
  QUALIFIED_LOST: 'Qualified Lost',
  JOB_CLOSED: 'Job Closed',
  WON: 'Won',
  LOST: 'Lost',
  CLOSED: 'Closed',
};

export type LeadStatusCode = LeadStatus;
export type LeadStatusLabel = (typeof leadStatusLabelMap)[LeadStatus];

export type LeadSummary = {
  id: string;
  title: string;
  profileName: string;
  status: LeadStatusLabel;
  statusCode: LeadStatusCode;
  matchScore: number;
  confidence: 'Low' | 'Medium' | 'High';
  budget: string;
  sourceCompleteness: 'Partial' | 'Full';
  createdAt: string;
  proposal: string;
  summary: string[];
  sourceUrl: string | null;
};

export type LeadEnrichment = {
  description: string | null;
  budget: string | null;
  paymentType: string | null;
  proposalsCount: number | null;
  client: {
    location: string | null;
    totalSpent: string | null;
    totalHires: number | null;
    rating: number | null;
    paymentVerified: boolean | null;
    memberSince: string | null;
  };
};

export type LeadDetail = {
  id: string;
  title: string;
  profileName: string;
  accountName: string;
  status: LeadStatusLabel;
  statusCode: LeadStatusCode;
  matchScore: number;
  confidence: 'Low' | 'Medium' | 'High';
  budget: string;
  sourceCompleteness: 'Partial' | 'Full';
  createdAt: string;
  createdAtIso: string;
  sourceUrl: string | null;
  enrichment: LeadEnrichment | null;
  enrichedAt: string | null;
  sender: string | null;
  emailSubject: string | null;
  emailSnippet: string | null;
  rawEmailBody: string | null;
  extractedSkills: string[];
  summary: string[];
  rejectionReasons: string[];
  matchedKeywords: string[];
  application: {
    id: string;
    connectsSpent: number | null;
    appliedAt: string | null;
    lastFollowUpAt: string | null;
    notes: string;
    updatedAt: string;
  } | null;
  proposals: Array<{
    id: string;
    content: string;
    isPrimary: boolean;
    isAiGenerated: boolean;
    createdAt: string;
    createdAtIso: string;
  }>;
  events: Array<{
    id: string;
    type: string;
    createdAt: string;
    createdAtIso: string;
    payload: Record<string, unknown> | null;
  }>;
};

export type EvaluationResult = {
  score: number;
  confidence: number;
  hardFilterPassed: boolean;
  rejectionReasons: string[];
  matchedKeywords: string[];
  summary: string[];
};
