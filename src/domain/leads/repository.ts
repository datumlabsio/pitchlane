import type { LeadStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { leadStatusLabelMap, type LeadDetail, type LeadEnrichment, type LeadSummary } from '@/domain/leads/types';

function mapEnrichment(value: unknown): LeadEnrichment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const e = value as Record<string, unknown>;
  const client = (e.client && typeof e.client === 'object' ? e.client : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    description: str(e.description),
    budget: str(e.budget),
    paymentType: str(e.paymentType),
    proposalsCount: num(e.proposalsCount),
    client: {
      location: str(client.location),
      totalSpent: str(client.totalSpent),
      totalHires: num(client.totalHires),
      rating: num(client.rating),
      paymentVerified: typeof client.paymentVerified === 'boolean' ? client.paymentVerified : null,
      memberSince: str(client.memberSince),
    },
  };
}

function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
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

  const where = {
    ...(opts.accountId ? { accountId: opts.accountId } : {}),
    ...(opts.status ? { status: opts.status as LeadStatus } : {}),
    ...(opts.search
      ? { title: { contains: opts.search, mode: 'insensitive' as const } }
      : {}),
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
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const items = leads.map<LeadSummary>((lead) => {
    const evaluation = lead.evaluations[0];
    const proposal = lead.proposals[0];
    const confidence = evaluation?.confidence ?? lead.confidence;

    return {
      id: lead.id,
      title: lead.title,
      profileName: lead.account.personName,
      status: leadStatusLabelMap[lead.status] ?? 'New',
      statusCode: lead.status,
      matchScore: evaluation?.score ?? 0,
      confidence: toConfidenceLabel(confidence),
      budget: lead.extractedBudget || 'Unknown',
      sourceCompleteness: lead.sourceCompleteness === 'FULL' ? 'Full' : 'Partial',
      createdAt: formatRelative(lead.createdAt),
      proposal: proposal?.content ?? '',
      summary: evaluation?.summary ?? [],
      sourceUrl: lead.sourceUrl,
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
  const confidence = evaluation?.confidence ?? lead.confidence;

  return {
    id: lead.id,
    title: lead.title,
    profileName: lead.account.personName,
    accountName: lead.account.name,
    status: leadStatusLabelMap[lead.status] ?? 'New',
    statusCode: lead.status,
    matchScore: evaluation?.score ?? 0,
    confidence: toConfidenceLabel(confidence),
    budget: lead.extractedBudget || 'Unknown',
    sourceCompleteness: lead.sourceCompleteness === 'FULL' ? 'Full' : 'Partial',
    createdAt: formatDateTime(lead.createdAt),
    createdAtIso: lead.createdAt.toISOString(),
    sourceUrl: lead.sourceUrl,
    enrichment: mapEnrichment(lead.enrichment),
    enrichedAt: lead.enrichedAt ? formatDateTime(lead.enrichedAt) : null,
    sender: lead.sender,
    emailSubject: lead.emailSubject,
    emailSnippet: lead.emailSnippet,
    rawEmailBody: lead.rawEmailBody,
    extractedSkills: lead.extractedSkills,
    summary: evaluation?.summary ?? [],
    rejectionReasons: evaluation?.rejectionReasons ?? [],
    matchedKeywords: evaluation?.matchedKeywords ?? [],
    application: application
      ? {
          id: application.id,
          connectsSpent: application.connectsSpent,
          appliedAt: application.appliedAt?.toISOString() ?? null,
          lastFollowUpAt: application.lastFollowUpAt?.toISOString() ?? null,
          notes: application.notes ?? '',
          updatedAt: formatDateTime(application.updatedAt),
        }
      : null,
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
