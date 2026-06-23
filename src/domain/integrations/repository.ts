import { IntegrationProvider, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export async function upsertGoogleConnection(input: {
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: Date | null;
  scopes?: string[];
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.integrationConnection.upsert({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL },
    update: {
      email: input.email,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiryDate: input.expiryDate ?? null,
      scopes: input.scopes ?? [],
      metadata: input.metadata,
    },
    create: {
      provider: IntegrationProvider.GOOGLE_GMAIL,
      email: input.email,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiryDate: input.expiryDate ?? null,
      scopes: input.scopes ?? [],
      metadata: input.metadata,
    },
  });
}

export async function getGoogleConnection() {
  return prisma.integrationConnection.findUnique({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL },
  });
}

export function getMetaSyncInterval(metadata: unknown): number {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const m = metadata as Record<string, unknown>;
    if (typeof m.syncIntervalMinutes === 'number' && m.syncIntervalMinutes > 0) {
      return m.syncIntervalMinutes;
    }
  }
  return 5;
}

/** Global minimum match score (%) for a lead to be sent to Slack. Default 40. */
export function getMetaSlackMinScore(metadata: unknown): number {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const m = metadata as Record<string, unknown>;
    if (typeof m.slackMinScore === 'number' && m.slackMinScore >= 0 && m.slackMinScore <= 100) {
      return m.slackMinScore;
    }
  }
  return 40;
}

/** Read the global Slack alert threshold from the Gmail connection metadata. */
export async function getSlackMinScore(): Promise<number> {
  const connection = await getGoogleConnection();
  return getMetaSlackMinScore(connection?.metadata);
}

export async function getGoogleConnectionStatus() {
  const connection = await getGoogleConnection();
  const latestSync = await prisma.syncRun.findFirst({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL },
    orderBy: { startedAt: 'desc' },
  });

  return {
    connected: Boolean(connection?.refreshToken || connection?.accessToken),
    email: connection?.email ?? null,
    scopes: connection?.scopes ?? [],
    updatedAt: connection?.updatedAt ?? null,
    syncIntervalMinutes: getMetaSyncInterval(connection?.metadata),
    slackMinScore: getMetaSlackMinScore(connection?.metadata),
    latestSync: latestSync
      ? {
          startedAt: latestSync.startedAt,
          finishedAt: latestSync.finishedAt,
          status: latestSync.status,
          messagesScanned: latestSync.messagesScanned,
          leadsCreated: latestSync.leadsCreated,
          duplicatesSkipped: latestSync.duplicatesSkipped,
          errorsCount: latestSync.errorsCount,
          errorSummary: latestSync.errorSummary,
        }
      : null,
  };
}

/** Lightweight single-query lookup of the last completed Gmail sync time — used by the sidebar. */
export async function getLastGmailSyncAt(): Promise<Date | null> {
  const latest = await prisma.syncRun.findFirst({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL, status: { not: 'running' } },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true },
  });
  return latest?.finishedAt ?? null;
}

export async function shouldRunGmailSync(): Promise<{ should: boolean; nextInSeconds: number }> {
  const [connection, latestSync] = await Promise.all([
    getGoogleConnection(),
    prisma.syncRun.findFirst({
      where: { provider: IntegrationProvider.GOOGLE_GMAIL, status: { not: 'running' } },
      orderBy: { finishedAt: 'desc' },
    }),
  ]);

  const intervalMs = getMetaSyncInterval(connection?.metadata) * 60 * 1000;

  if (!latestSync?.finishedAt) return { should: true, nextInSeconds: 0 };

  const elapsed = Date.now() - latestSync.finishedAt.getTime();
  const should = elapsed >= intervalMs;
  return {
    should,
    nextInSeconds: should ? 0 : Math.ceil((intervalMs - elapsed) / 1000),
  };
}

export async function updateGmailSyncInterval(minutes: number) {
  const connection = await getGoogleConnection();
  const currentMeta = (connection?.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata))
    ? (connection.metadata as Record<string, unknown>)
    : {};
  return prisma.integrationConnection.update({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL },
    data: { metadata: { ...currentMeta, syncIntervalMinutes: minutes } },
  });
}

export async function updateSlackMinScore(score: number) {
  const connection = await getGoogleConnection();
  const currentMeta = (connection?.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata))
    ? (connection.metadata as Record<string, unknown>)
    : {};
  // Upsert so the threshold can be set even before Gmail is connected.
  return prisma.integrationConnection.upsert({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL },
    update: { metadata: { ...currentMeta, slackMinScore: score } },
    create: { provider: IntegrationProvider.GOOGLE_GMAIL, metadata: { slackMinScore: score } },
  });
}

export async function createSyncRun(input: {
  provider: IntegrationProvider;
  integrationId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.syncRun.create({
    data: {
      provider: input.provider,
      integrationId: input.integrationId,
      status: 'running',
      metadata: input.metadata,
    },
  });
}

export async function completeSyncRun(input: {
  id: string;
  status: 'success' | 'partial' | 'failed';
  messagesScanned: number;
  leadsCreated: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errorSummary?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.syncRun.update({
    where: { id: input.id },
    data: {
      status: input.status,
      finishedAt: new Date(),
      messagesScanned: input.messagesScanned,
      leadsCreated: input.leadsCreated,
      duplicatesSkipped: input.duplicatesSkipped,
      errorsCount: input.errorsCount,
      errorSummary: input.errorSummary ?? null,
      metadata: input.metadata,
    },
  });
}
