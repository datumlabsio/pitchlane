import { LeadStatus } from '@prisma/client';

import { getActorName } from '@/lib/auth/actor';
import { prisma } from '@/lib/prisma';

export type UpsertApplicationInput = {
  leadId: string;
  // Every field but leadId is partial: undefined leaves the stored value untouched
  // (null explicitly clears). The full form sends everything; quick actions (kanban
  // drop, review toggles) send only what they change, so they can't clobber the rest.
  connectsSpent?: number | null;
  appliedAt?: Date | null;
  lastFollowUpAt?: Date | null;
  notes?: string;
  connectsRefunded?: number | null;
  sentProposal?: string | null;
  proposalFeedback?: string | null;
  buReviewed?: boolean;
  proposalViewed?: boolean;
};

export async function upsertApplication(input: UpsertApplicationInput) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, accountId: true, status: true },
  });

  if (!lead) {
    throw new Error('Lead not found');
  }

  const actor = await getActorName();

  const changedFields = {
    ...(input.connectsSpent !== undefined ? { connectsSpent: input.connectsSpent } : {}),
    ...(input.appliedAt !== undefined ? { appliedAt: input.appliedAt } : {}),
    ...(input.lastFollowUpAt !== undefined ? { lastFollowUpAt: input.lastFollowUpAt } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
    ...(input.connectsRefunded !== undefined ? { connectsRefunded: input.connectsRefunded } : {}),
    ...(input.sentProposal !== undefined ? { sentProposal: input.sentProposal || null } : {}),
    ...(input.proposalFeedback !== undefined ? { proposalFeedback: input.proposalFeedback || null } : {}),
    ...(input.buReviewed !== undefined ? { buReviewed: input.buReviewed } : {}),
    ...(input.proposalViewed !== undefined ? { proposalViewed: input.proposalViewed } : {}),
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.application.findFirst({
      where: { leadId: input.leadId },
      orderBy: { createdAt: 'desc' },
    });

    const application = existing
      ? await tx.application.update({
          where: { id: existing.id },
          data: changedFields,
        })
      : await tx.application.create({
          data: {
            leadId: input.leadId,
            accountId: lead.accountId,
            connectsSpent: input.connectsSpent ?? null,
            appliedAt: input.appliedAt ?? null,
            lastFollowUpAt: input.lastFollowUpAt ?? null,
            notes: input.notes || null,
            connectsRefunded: input.connectsRefunded ?? null,
            sentProposal: input.sentProposal ?? null,
            proposalFeedback: input.proposalFeedback ?? null,
            buReviewed: input.buReviewed ?? false,
            proposalViewed: input.proposalViewed ?? false,
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
            actor,
          },
        },
      });
    }

    // Manager feedback and the review toggles get their own activity entries — the
    // whole point is that BD can see WHO reviewed/left feedback, and managers can
    // see the review actually happened.
    if (input.proposalFeedback !== undefined && (input.proposalFeedback || null) !== (existing?.proposalFeedback ?? null)) {
      await tx.leadEvent.create({
        data: {
          leadId: input.leadId,
          type: 'proposal.feedback_updated',
          payload: {
            actor,
            excerpt: input.proposalFeedback ? input.proposalFeedback.slice(0, 280) : null,
          },
        },
      });
    }
    if (input.sentProposal !== undefined && (input.sentProposal || null) !== (existing?.sentProposal ?? null)) {
      await tx.leadEvent.create({
        data: {
          leadId: input.leadId,
          type: 'proposal.sent_recorded',
          payload: { actor, chars: input.sentProposal?.length ?? 0 },
        },
      });
    }
    if (input.buReviewed !== undefined && input.buReviewed !== (existing?.buReviewed ?? false)) {
      await tx.leadEvent.create({
        data: {
          leadId: input.leadId,
          type: 'application.bu_review_updated',
          payload: { actor, buReviewed: input.buReviewed },
        },
      });
    }
    if (input.proposalViewed !== undefined && input.proposalViewed !== (existing?.proposalViewed ?? false)) {
      await tx.leadEvent.create({
        data: {
          leadId: input.leadId,
          type: 'application.proposal_viewed_updated',
          payload: { actor, proposalViewed: input.proposalViewed },
        },
      });
    }

    // The generic saved-event only when core application fields were part of the
    // call — a review-toggle-only save already logged its own specific event above,
    // and shouldn't add an "application updated" noise entry on top.
    const coreFieldsTouched =
      input.connectsSpent !== undefined ||
      input.appliedAt !== undefined ||
      input.lastFollowUpAt !== undefined ||
      input.notes !== undefined ||
      input.connectsRefunded !== undefined;
    if (!existing || coreFieldsTouched) {
      await tx.leadEvent.create({
        data: {
          leadId: input.leadId,
          type: existing ? 'application.updated' : 'application.created',
          payload: {
            ...(input.connectsSpent !== undefined ? { connectsSpent: input.connectsSpent } : {}),
            ...(input.connectsRefunded !== undefined ? { connectsRefunded: input.connectsRefunded } : {}),
            appliedAt: input.appliedAt?.toISOString() ?? null,
            lastFollowUpAt: input.lastFollowUpAt?.toISOString() ?? null,
            actor,
          },
        },
      });
    }

    return application;
  });
}
