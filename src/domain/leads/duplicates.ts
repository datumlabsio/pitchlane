import { prisma } from '@/lib/prisma';

/** The `~02…` Upwork job ciphertext in a lead URL — identical across accounts for
 *  the same job, so it's how we detect the same job landing on multiple profiles. */
export function jobCiphertext(url: string | null | undefined): string | null {
  return url?.match(/~[0-9]{6,}/)?.[0] ?? null;
}

export type DuplicateSibling = {
  leadId: string;
  accountId: string;
  profile: string;
  score: number;
  status: string;
  enrichedAt: Date | null;
  rejected: boolean;
};

/**
 * Other accounts' leads for the SAME Upwork job (matched by ciphertext). Used to
 * de-duplicate Slack alerts across profiles and to surface "also matched on N
 * profiles" in the lead panel so the same job isn't pursued by two profiles.
 */
export async function findDuplicateSiblings(args: {
  leadId: string;
  sourceUrl: string | null;
  accountId: string;
}): Promise<DuplicateSibling[]> {
  const cipher = jobCiphertext(args.sourceUrl);
  if (!cipher) return [];

  const siblings = await prisma.lead.findMany({
    where: {
      id: { not: args.leadId },
      accountId: { not: args.accountId },
      sourceUrl: { contains: cipher },
    },
    include: { account: true, evaluations: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  return siblings.map((s) => ({
    leadId: s.id,
    accountId: s.accountId,
    profile: s.account.personName,
    score: s.evaluations[0]?.score ?? 0,
    status: s.status,
    enrichedAt: s.enrichedAt,
    rejected: (s.evaluations[0]?.rejectionReasons?.length ?? 0) > 0,
  }));
}
