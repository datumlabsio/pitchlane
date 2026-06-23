import { LeadStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildCreatedAtRange, type DateWindow } from '@/lib/date-window';

// Statuses that mean the lead was ever qualified (i.e. it moved past the initial screening)
const QUALIFIED_STATUSES: LeadStatus[] = [
  LeadStatus.QUALIFIED,
  LeadStatus.APPLIED,
  LeadStatus.CLIENT_REPLIED,
  LeadStatus.INTRO_CALL,
  LeadStatus.FOLLOW_UP,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.HIRES_OTHER,
  LeadStatus.QUALIFIED_LOST,
  LeadStatus.JOB_CLOSED,
  LeadStatus.WON,
  LeadStatus.LOST,
];

// Statuses that mean a proposal was actually submitted
const APPLIED_STATUSES: LeadStatus[] = [
  LeadStatus.APPLIED,
  LeadStatus.CLIENT_REPLIED,
  LeadStatus.INTRO_CALL,
  LeadStatus.FOLLOW_UP,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.HIRES_OTHER,
  LeadStatus.JOB_CLOSED,
  LeadStatus.WON,
  LeadStatus.LOST,
];

export async function getPipelineFunnel(window: DateWindow = {}) {
  const createdAt = buildCreatedAtRange(window);
  const base = createdAt ? { createdAt } : {};
  const [total, qualified, applied, won] = await Promise.all([
    prisma.lead.count({ where: base }),
    prisma.lead.count({ where: { ...base, status: { in: QUALIFIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: { in: APPLIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: LeadStatus.WON } }),
  ]);
  return { total, qualified, applied, won };
}

export async function getStatusBreakdown(window: DateWindow = {}) {
  const createdAt = buildCreatedAtRange(window);
  const groups = await prisma.lead.groupBy({
    by: ['status'],
    where: createdAt ? { createdAt } : undefined,
    _count: { _all: true },
    orderBy: { _count: { status: 'desc' } },
  });
  return groups.map((g) => ({ status: g.status as LeadStatus, count: g._count._all }));
}

export async function getRecentQualifiedLeads(window: DateWindow = {}) {
  const createdAt = buildCreatedAtRange(window);
  const leads = await prisma.lead.findMany({
    where: { status: { in: [LeadStatus.QUALIFIED, LeadStatus.NEW] }, ...(createdAt ? { createdAt } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: {
      account: true,
      evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return leads.map((lead) => ({
    id: lead.id,
    title: lead.title,
    profileName: lead.account.personName,
    status: lead.status,
    score: lead.evaluations[0]?.score ?? 0,
    budget: lead.extractedBudget || 'Unknown',
    createdAt: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(lead.createdAt),
  }));
}

export async function getDashboardMetrics(window: DateWindow = {}) {
  const createdAt = buildCreatedAtRange(window);
  const base = createdAt ? { createdAt } : {};
  const [totalLeads, won, applied, qualified] = await Promise.all([
    prisma.lead.count({ where: base }),
    prisma.lead.count({ where: { ...base, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { ...base, status: { in: APPLIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: { in: QUALIFIED_STATUSES } } }),
  ]);

  const qualRate = totalLeads === 0 ? 0 : Math.round((qualified / totalLeads) * 100);
  const winRate = applied === 0 ? 0 : Math.round((won / applied) * 100);

  return [
    { label: 'Leads Received', value: String(totalLeads), note: 'Across all active profiles' },
    { label: 'Qualification Rate', value: `${qualRate}%`, note: 'Passed scoring evaluation' },
    { label: 'Applications Sent', value: String(applied), note: 'Proposals submitted' },
    { label: 'Win Rate', value: `${winRate}%`, note: `${won} contract${won !== 1 ? 's' : ''} won` },
  ];
}

export async function getProfilePerformanceRows(window: DateWindow = {}) {
  const createdAt = buildCreatedAtRange(window);
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: {
      leads: { where: createdAt ? { createdAt } : undefined, select: { status: true } },
      applications: { where: createdAt ? { createdAt } : undefined, select: { connectsSpent: true } },
    },
    orderBy: { name: 'asc' },
  });

  return accounts.map((account) => {
    const leads = account.leads.length;
    const qualified = account.leads.filter((l) => QUALIFIED_STATUSES.includes(l.status as LeadStatus)).length;
    const applied = account.leads.filter((l) => APPLIED_STATUSES.includes(l.status as LeadStatus)).length;
    const won = account.leads.filter((l) => l.status === LeadStatus.WON).length;
    const connects = account.applications.reduce((sum, a) => sum + (a.connectsSpent ?? 0), 0);

    return {
      accountId: account.id,
      profile: account.personName,
      leads,
      qualified,
      qualRate: leads > 0 ? Math.round((qualified / leads) * 100) : 0,
      applied,
      applyRate: qualified > 0 ? Math.round((applied / qualified) * 100) : 0,
      won,
      winRate: applied > 0 ? Math.round((won / applied) * 100) : 0,
      connects,
    };
  });
}
