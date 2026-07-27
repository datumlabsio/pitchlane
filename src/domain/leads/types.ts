import type { LeadStatus } from '@prisma/client';

// Canonical pipeline statuses shown anywhere in the app (decision 9 / PRD v1.4).
// NEW is filterable but not settable via the lifecycle pills — it is the entry stage only.
export const leadFilterStatuses = [
  'NEW',
  'QUALIFIED',
  'REJECTED',
  'APPLIED',
  'CLIENT_REPLIED',
  'INTRO_CALL',
  'ONGOING_DISCUSSION',
  'HIRES_OTHER',
  'JOB_CLOSED',
  'WON',
  'LOST',
] as const satisfies readonly LeadStatus[];

// The settable lifecycle stages (NEW is entry-only).
export const leadLifecycleStatuses = [
  'QUALIFIED',
  'REJECTED',
  'APPLIED',
  'CLIENT_REPLIED',
  'INTRO_CALL',
  'ONGOING_DISCUSSION',
  'HIRES_OTHER',
  'JOB_CLOSED',
  'WON',
  'LOST',
] as const satisfies readonly LeadStatus[];

export const leadStatusLabelMap: Record<LeadStatus, string> = {
  NEW: 'New',
  QUALIFIED: 'Qualified',
  REJECTED: 'Rejected',
  APPLIED: 'Applied',
  CLIENT_REPLIED: 'Client Replied',
  INTRO_CALL: 'First Call',
  ONGOING_DISCUSSION: 'Ongoing Discussion',
  HIRES_OTHER: 'Hired Other',
  JOB_CLOSED: 'Job Closed',
  WON: 'Won',
  LOST: 'Lost',
};

export type LeadStatusCode = LeadStatus;
export type LeadStatusLabel = (typeof leadStatusLabelMap)[LeadStatus];

export type LeadSummary = {
  id: string;
  title: string;
  profileName: string;
  accountId: string;
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
  // null = never applied; else whether the CLIENT viewed the proposal on Upwork.
  proposalViewed: boolean | null;
};

export type LeadEnrichment = {
  status: 'enriched' | 'private' | 'failed' | null;
  // How the description was obtained, when enriched.
  source: 'upwork_api' | 'bright_data' | null;
  description: string | null;
  budget: string | null;
  paymentType: string | null;
  proposalsCount: number | null;
  client: {
    location: string | null;
    country: string | null;
    totalSpent: string | null;
    totalHires: number | null;
    activeHires: number | null;
    hours: number | null;
    rating: number | null;
    paymentVerified: boolean | null;
    memberSince: string | null;
    industry: string | null;
    companySize: string | null;
  };
};

export type LeadDetail = {
  id: string;
  title: string;
  profileName: string;
  accountId: string;
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
  brief: string;
  extractedSkills: string[];
  summary: string[];
  rejectionReasons: string[];
  matchedKeywords: string[];
  // Same Upwork job on other profiles (agency multi-profile dedupe).
  duplicates: Array<{ leadId: string; profile: string; score: number; status: LeadStatusLabel }>;
  // Portfolio projects ranked relevant to this job — cited (with links) in generated proposals.
  relevantProjects: Array<{ id: string; title: string; url: string | null }>;
  // Other profiles the background judge thinks this job also fits — suggestions only;
  // a human copies via the multi-apply dialog.
  profileSuggestions: Array<{ accountId: string; profile: string; fitScore: number }>;
  application: {
    id: string;
    connectsSpent: number | null;
    connectsRefunded: number | null;
    appliedAt: string | null;
    lastFollowUpAt: string | null;
    notes: string;
    sentProposal: string;
    proposalFeedback: string;
    buReviewed: boolean;
    proposalViewed: boolean;
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
