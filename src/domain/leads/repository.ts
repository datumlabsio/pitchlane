import type { LeadStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildCreatedAtRange } from '@/lib/date-window';

import { cleanEmailBrief } from '@/lib/utils';
import { leadStatusLabelMap, type LeadDetail, type LeadEnrichment, type LeadSummary } from '@/domain/leads/types';
import { findDuplicateSiblings } from '@/domain/leads/duplicates';
import { relevantProjectsForJob } from '@/domain/projects/relevant-projects';

function mapEnrichment(value: unknown): LeadEnrichment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const e = value as Record<string, unknown>;
  const client = (e.client && typeof e.client === 'object' ? e.client : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const status = e.status === 'enriched' || e.status === 'private' || e.status === 'failed' ? e.status : null;
  const source = e.source === 'upwork_api' || e.source === 'bright_data' ? e.source : null;
  return {
    status,
    source,
    description: str(e.description),
    budget: str(e.budget),
    paymentType: str(e.paymentType),
    proposalsCount: num(e.proposalsCount),
    client: {
      location: str(client.location),
      country: str(client.country),
      totalSpent: str(client.totalSpent),
      totalHires: num(client.totalHires),
      activeHires: num(client.activeHires),
      hours: num(client.hours),
      rating: num(client.rating),
      paymentVerified: typeof client.paymentVerified === 'boolean' ? client.paymentVerified : null,
      memberSince: str(client.memberSince),
      industry: str(client.industry),
      companySize: str(client.companySize),
    },
  };
}

// lead.profileSuggestions JSON → typed list for the panel. Shape written by the
// suggest-profiles job: { computedAt, suggestions: [{accountId, profile, fitScore}] }.
function mapProfileSuggestions(value: unknown): LeadDetail['profileSuggestions'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const list = (value as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (s): s is { accountId: string; profile: string; fitScore: number } =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as Record<string, unknown>).accountId === 'string' &&
        typeof (s as Record<string, unknown>).profile === 'string' &&
        typeof (s as Record<string, unknown>).fitScore === 'number',
    )
    .map((s) => ({ accountId: s.accountId, profile: s.profile, fitScore: s.fitScore }));
}

function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function toConfidenceLabel(confidence: number) {
  if (confidence >= 75) return 'High';
  if (confidence >= 55) return 'Medium';
  return 'Low';
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export type LeadListOptions = {
  page?: number;
  limit?: number;
  accountId?: string;
  status?: string;
  search?: string;
  since?: string;
  /** Custom range (yyyy-MM-dd). Takes precedence over `since` when set. */
  from?: string;
  to?: string;
};

export type LeadListResult = {
  items: LeadSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function listLeadSummaries(opts: LeadListOptions = {}): Promise<LeadListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, opts.limit ?? 20);
  const skip = (page - 1) * limit;

  const createdAt = buildCreatedAtRange(opts);
  // accountId/status are comma-separated lists (multi-select filters).
  const accountIds = (opts.accountId ?? '').split(',').filter(Boolean);
  const statuses = (opts.status ?? '').split(',').filter(Boolean) as LeadStatus[];

  // Free-text search across title, subject, body, sender, the job URL and the
  // enriched description — not just the title. If the term carries an Upwork job
  // ciphertext (e.g. a pasted job URL like .../jobs/~022069…), match the stored
  // sourceUrl on just that id, so the email's trailing query string doesn't matter.
  const term = opts.search?.trim();
  const cipher = term?.match(/~[0-9]+/)?.[0];
  const searchClause: Prisma.LeadWhereInput = term
    ? {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { emailSubject: { contains: term, mode: 'insensitive' } },
          { rawEmailBody: { contains: term, mode: 'insensitive' } },
          { sender: { contains: term, mode: 'insensitive' } },
          { sourceUrl: { contains: cipher ?? term, mode: 'insensitive' } },
          { enrichment: { path: ['description'], string_contains: term } },
        ],
      }
    : {};

  const where: Prisma.LeadWhereInput = {
    ...(accountIds.length ? { accountId: { in: accountIds } } : {}),
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...searchClause,
    ...(createdAt ? { createdAt } : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        account: true,
        evaluations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        proposals: {
          where: { isPrimary: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        applications: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { proposalViewed: true, appliedAt: true },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const items = leads.map<LeadSummary>((lead) => {
    const evaluation = lead.evaluations[0];
    const proposal = lead.proposals[0];

    return {
      id: lead.id,
      title: lead.title,
      profileName: lead.account.personName,
      accountId: lead.accountId,
      status: leadStatusLabelMap[lead.status] ?? 'New',
      statusCode: lead.status,
      matchScore: evaluation?.score ?? 0,
      // Tier reflects the match score, so it never contradicts it (the old
      // text-length "confidence" could read High next to a low match).
      confidence: toConfidenceLabel(evaluation?.score ?? 0),
      budget: lead.extractedBudget || 'Unknown',
      sourceCompleteness: lead.sourceCompleteness === 'FULL' ? 'Full' : 'Partial',
      createdAt: formatRelative(lead.createdAt),
      proposal: proposal?.content ?? '',
      summary: evaluation?.summary ?? [],
      sourceUrl: lead.sourceUrl,
      // null = never applied; boolean = whether the CLIENT viewed the proposal on Upwork.
      proposalViewed: lead.applications[0]?.appliedAt ? lead.applications[0].proposalViewed : null,
    };
  });

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLeadDetail(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      account: true,
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      applications: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      proposals: {
        orderBy: { createdAt: 'desc' },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
    },
  });

  if (!lead) {
    return null;
  }

  const evaluation = lead.evaluations[0];
  const application = lead.applications[0];
  const enrichmentView = mapEnrichment(lead.enrichment);
  const jobText = [lead.title, lead.rawEmailBody ?? lead.emailSnippet ?? '', enrichmentView?.description ?? '']
    .filter(Boolean)
    .join('\n');
  const [siblings, relevantProjects] = await Promise.all([
    findDuplicateSiblings({ leadId, sourceUrl: lead.sourceUrl, accountId: lead.accountId }),
    relevantProjectsForJob(lead.accountId, jobText),
  ]);

  return {
    id: lead.id,
    title: lead.title,
    profileName: lead.account.personName,
    accountId: lead.accountId,
    accountName: lead.account.name,
    status: leadStatusLabelMap[lead.status] ?? 'New',
    statusCode: lead.status,
    matchScore: evaluation?.score ?? 0,
    // Tier reflects the match score, so it never contradicts it.
    confidence: toConfidenceLabel(evaluation?.score ?? 0),
    budget: lead.extractedBudget || 'Unknown',
    sourceCompleteness: lead.sourceCompleteness === 'FULL' ? 'Full' : 'Partial',
    createdAt: formatDateTime(lead.createdAt),
    createdAtIso: lead.createdAt.toISOString(),
    sourceUrl: lead.sourceUrl,
    enrichment: enrichmentView,
    enrichedAt: lead.enrichedAt ? formatDateTime(lead.enrichedAt) : null,
    sender: lead.sender,
    emailSubject: lead.emailSubject,
    emailSnippet: lead.emailSnippet,
    rawEmailBody: lead.rawEmailBody,
    brief: cleanEmailBrief(lead.rawEmailBody ?? lead.emailSnippet ?? ''),
    extractedSkills: lead.extractedSkills,
    summary: evaluation?.summary ?? [],
    rejectionReasons: evaluation?.rejectionReasons ?? [],
    matchedKeywords: evaluation?.matchedKeywords ?? [],
    duplicates: siblings.map((s) => ({
      leadId: s.leadId,
      profile: s.profile,
      score: s.score,
      status: leadStatusLabelMap[s.status as LeadStatus] ?? 'New',
    })),
    relevantProjects: relevantProjects.map((p) => ({ id: p.id, title: p.title, url: p.url })),
    application: application
      ? {
          id: application.id,
          connectsSpent: application.connectsSpent,
          connectsRefunded: application.connectsRefunded,
          appliedAt: application.appliedAt?.toISOString() ?? null,
          lastFollowUpAt: application.lastFollowUpAt?.toISOString() ?? null,
          notes: application.notes ?? '',
          sentProposal: application.sentProposal ?? '',
          proposalFeedback: application.proposalFeedback ?? '',
          buReviewed: application.buReviewed,
          proposalViewed: application.proposalViewed,
          updatedAt: formatDateTime(application.updatedAt),
        }
      : null,
    profileSuggestions: mapProfileSuggestions(lead.profileSuggestions),
    proposals: lead.proposals.map((proposal) => ({
      id: proposal.id,
      content: proposal.content,
      isPrimary: proposal.isPrimary,
      isAiGenerated: proposal.isAiGenerated,
      createdAt: formatDateTime(proposal.createdAt),
      createdAtIso: proposal.createdAt.toISOString(),
    })),
    events: lead.events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: formatDateTime(event.createdAt),
      createdAtIso: event.createdAt.toISOString(),
      payload:
        event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
          ? (event.payload as Record<string, unknown>)
          : null,
    })),
  } satisfies LeadDetail;
}
