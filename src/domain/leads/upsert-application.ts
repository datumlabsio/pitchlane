import { LeadStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type UpsertApplicationInput = {
  leadId: string;
  connectsSpent: number | null;
  appliedAt: Date | null;
  lastFollowUpAt: Date | null;
  notes: string;
};

export async function upsertApplication(input: UpsertApplicationInput) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, accountId: true, status: true },
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: { leadId: input.leadId },
      orderBy: { createdAt: 'desc' },
    });

    const application = existing
      ? await tx.application.update({
          where: { id: existing.id },
          data: {
            connectsSpent: input.connectsSpent,
            appliedAt: input.appliedAt,
            lastFollowUpAt: input.lastFollowUpAt,
            notes: input.notes || null,
          },
        })
      : await tx.application.create({
          data: {
            leadId: input.leadId,
            accountId: lead.accountId,
            connectsSpent: input.connectsSpent,
            appliedAt: input.appliedAt,
            lastFollowUpAt: input.lastFollowUpAt,
            notes: input.notes || null,
          },
        });

    const nextStatus = input.appliedAt && lead.status === LeadStatus.NEW
      ? LeadStatus.APPLIED
      : input.appliedAt && lead.status === LeadStatus.QUALIFIED
        ? LeadStatus.APPLIED
        : lead.status;

    if (nextStatus !== lead.status) {
      await tx.lead.update({
        where: { id: input.leadId },
        data: { status: nextStatus },
      });

      await tx.leadEvent.create({
        data: {
          leadId: input.leadId,
          type: 'lead.status_updated',
          payload: {
            from: lead.status,
            to: nextStatus,
            reason: 'application_upsert',
          },
        },
      });
    }

    await tx.leadEvent.create({
      data: {
        leadId: input.leadId,
        type: existing ? 'application.updated' : 'application.created',
        payload: {
          connectsSpent: input.connectsSpent,
          appliedAt: input.appliedAt?.toISOString() ?? null,
          lastFollowUpAt: input.lastFollowUpAt?.toISOString() ?? null,
        },
      },
    });

    return application;
  });
}
