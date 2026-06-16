import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { AccountSettingsView, AccountUpdateInput } from './types';

export async function listActiveAccounts() {
  return prisma.account.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function findAccountByLabel(gmailLabel: string) {
  return prisma.account.findUnique({
    where: { gmailLabel },
    include: {
      profileConfigs: {
        where: { isActive: true },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
    },
  });
}

export async function updateAccountSettings(accountId: string, input: AccountUpdateInput): Promise<AccountSettingsView> {
  try {
    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        gmailLabel: input.gmailLabel,
        forwardingInbox: input.forwardingInbox,
        notificationEmail: input.notificationEmail || null,
        isActive: input.isActive,
      },
    });

    return {
      id: account.id,
      name: account.name,
      personName: account.personName,
      gmailLabel: account.gmailLabel,
      forwardingInbox: account.forwardingInbox,
      notificationEmail: account.notificationEmail,
      isActive: account.isActive,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('That Gmail label is already assigned to another account.');
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new Error('Account not found.');
    }

    throw error;
  }
}
