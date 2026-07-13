import { LeadStatus } from '@prisma/client';

import { getActorName } from '@/lib/auth/actor';
import { prisma } from '@/lib/prisma';

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const existingLead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, status: true },
  });

  if (!existingLead) {
    throw new Error('Lead not found');
  }

  if (existingLead.status === status) {
    return prisma.lead.findUnique({ where: { id: leadId } });
  }

  const actor = await getActorName();

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.update({
      where: { id: leadId },
      data: { status },
    });

    await tx.leadEvent.create({
      data: {
        leadId,
        type: 'lead.status_updated',
        payload: {
          from: existingLead.status,
          to: status,
          actor,
        },
      },
    });

    return lead;
  });
}
