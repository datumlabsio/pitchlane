import { IntegrationProvider, Prisma, SourceCompleteness } from '@prisma/client';

import { listActiveAccounts } from '@/domain/accounts/repository';
import { completeSyncRun, createSyncRun, getGoogleConnection } from '@/domain/integrations/repository';
import { createLeadFromEmail } from '@/domain/leads/create-email-lead';
import { createAuthenticatedGmailClient, decodeMessageBody, getHeaderValue } from '@/lib/google/gmail';
import { prisma } from '@/lib/prisma';

// The old scan read only the N newest messages per label with no pagination or
// checkpoint — any burst deeper than N (e.g. the mailbox migration) was silently
// never ingested. Now every run LISTS all candidate ids in the scan window
// (cheap, paginated), diffs them against leads we already hold, and FETCHES only
// unknown messages, bounded per run; the remainder drains on subsequent runs.
const SCAN_WINDOW_DAYS = 30;
// Per-label checkpoint (epoch seconds) stored in connection.metadata.syncWatermarks.
// Re-listing overlaps the watermark slightly so late-delivered mail is never missed;
// the id-diff makes the overlap free.
const WATERMARK_OVERLAP_SECONDS = 6 * 3600;
const MAX_NEW_FETCHES_PER_LABEL = 50;

type SyncSummary = {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  messagesScanned: number;
  leadsCreated: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errorSummary: string | null;
  /** IDs of freshly-created leads with a job URL, for inline enrichment after the response. */
  newLeadIds: string[];
  labels: Array<{
    gmailLabel: string;
    scanned: number;
    created: number;
    duplicates: number;
    errors: number;
  }>;
};

export async function syncGmailInbox(): Promise<SyncSummary> {
  const connection = await getGoogleConnection();
  if (!connection) {
    throw new Error('Google Gmail is not connected.');
  }

  const run = await createSyncRun({
    provider: IntegrationProvider.GOOGLE_GMAIL,
    integrationId: connection.id,
  });

  let messagesScanned = 0;
  let leadsCreated = 0;
  let duplicatesSkipped = 0;
  let errorsCount = 0;
  const labelSummaries: SyncSummary['labels'] = [];
  const errorMessages: string[] = [];
  const newLeadIds: string[] = [];

  try {
    const gmail = await createAuthenticatedGmailClient();
    const accounts = await listActiveAccounts();
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labelIdByName = new Map(
      (labelsResponse.data.labels ?? []).map((label) => [label.name ?? '', label.id ?? '']),
    );

    const meta =
      connection.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata)
        ? (connection.metadata as Record<string, unknown>)
        : {};
    const watermarks: Record<string, number> =
      meta.syncWatermarks && typeof meta.syncWatermarks === 'object' && !Array.isArray(meta.syncWatermarks)
        ? { ...(meta.syncWatermarks as Record<string, number>) }
        : {};

    for (const account of accounts) {
      const gmailLabel = account.gmailLabel;
      const labelId = labelIdByName.get(gmailLabel);
      const perLabel = { gmailLabel, scanned: 0, created: 0, duplicates: 0, errors: 0 };

      let resolvedLabelId = labelId;
      if (!resolvedLabelId) {
        try {
          const created = await gmail.users.labels.create({
            userId: 'me',
            requestBody: { name: gmailLabel },
          });
          resolvedLabelId = created.data.id ?? undefined;
        } catch { /* will fall through to error below */ }
      }

      if (!resolvedLabelId) {
        perLabel.errors += 1;
        errorsCount += 1;
        errorMessages.push(`Could not find or create Gmail label: ${gmailLabel}`);
        labelSummaries.push(perLabel);
        continue;
      }

      // Window: from the label's checkpoint (minus overlap) or the max scan window.
      const nowEpoch = Math.floor(Date.now() / 1000);
      const windowFloor = nowEpoch - SCAN_WINDOW_DAYS * 24 * 3600;
      const since = watermarks[gmailLabel]
        ? Math.max(watermarks[gmailLabel] - WATERMARK_OVERLAP_SECONDS, windowFloor)
        : windowFloor;

      // 1) List every candidate id in the window (paginated — no silent cap).
      const messageIds: string[] = [];
      let pageToken: string | undefined;
      do {
        const page = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [resolvedLabelId],
          q: `after:${since}`,
          maxResults: 500,
          pageToken,
        });
        for (const m of page.data.messages ?? []) if (m.id) messageIds.push(m.id);
        pageToken = page.data.nextPageToken ?? undefined;
      } while (pageToken);

      // 2) Diff against leads we already ingested — known ids cost nothing.
      const knownKeys = new Set<string>();
      for (let i = 0; i < messageIds.length; i += 1000) {
        const chunk = messageIds.slice(i, i + 1000).map((id) => `gmail:${id}`.toLowerCase());
        const rows = await prisma.lead.findMany({
          where: { dedupeKey: { in: chunk } },
          select: { dedupeKey: true },
        });
        for (const row of rows) knownKeys.add(row.dedupeKey);
      }
      const unknownIds = messageIds.filter((id) => !knownKeys.has(`gmail:${id}`.toLowerCase()));

      // 3) Fetch + ingest only the unknown, bounded per run; leftovers drain on the
      // next run, so the watermark only advances once the label is fully caught up.
      const toFetch = unknownIds.slice(0, MAX_NEW_FETCHES_PER_LABEL);
      const caughtUp = unknownIds.length <= MAX_NEW_FETCHES_PER_LABEL;

      for (const messageId of toFetch) {
        perLabel.scanned += 1;
        messagesScanned += 1;

        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
          });

          const payload = fullMessage.data.payload;
          const subject = getHeaderValue(payload?.headers, 'Subject') || 'Untitled forwarded lead';
          const from = getHeaderValue(payload?.headers, 'From') || 'unknown';
          const body = decodeMessageBody(payload);
          const extracted = extractLeadSignals(subject, body);

          const result = await createLeadFromEmail({
            gmailLabel,
            from,
            subject,
            body: body || fullMessage.data.snippet || subject,
            externalMessageId: fullMessage.data.id ?? undefined,
            externalThreadId: fullMessage.data.threadId ?? undefined,
            sourceUrl: extracted.sourceUrl,
            extractedBudget: extracted.budget,
            extractedSkills: extracted.skills,
            sourceCompleteness: extracted.sourceCompleteness,
          });

          if (result.duplicate) {
            perLabel.duplicates += 1;
            duplicatesSkipped += 1;
          } else {
            perLabel.created += 1;
            leadsCreated += 1;
            // Enrichable leads (have a job URL) get enriched + alerted right after the
            // sync responds — see the route's after() hook.
            if (result.lead.sourceUrl) newLeadIds.push(result.lead.id);
          }
        } catch (error) {
          perLabel.errors += 1;
          errorsCount += 1;
          errorMessages.push(`${gmailLabel}: ${error instanceof Error ? error.message : 'Unknown sync error'}`);
        }
      }

      // Advance the checkpoint only when the label is fully drained with no
      // errors — unfetched backlog and failed messages get retried next run.
      if (caughtUp && perLabel.errors === 0) {
        watermarks[gmailLabel] = nowEpoch;
      }

      labelSummaries.push(perLabel);
    }

    // Persist checkpoints. Merge — metadata also carries other settings (e.g. the
    // Slack score threshold).
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { metadata: { ...meta, syncWatermarks: watermarks } as Prisma.InputJsonValue },
    });

    const status = errorsCount === 0 ? 'success' : leadsCreated > 0 || duplicatesSkipped > 0 ? 'partial' : 'failed';
    const errorSummary = errorMessages.length ? errorMessages.slice(0, 10).join(' | ') : null;

    await completeSyncRun({
      id: run.id,
      status,
      messagesScanned,
      leadsCreated,
      duplicatesSkipped,
      errorsCount,
      errorSummary,
      metadata: { labels: labelSummaries },
    });

    return {
      runId: run.id,
      status,
      messagesScanned,
      leadsCreated,
      duplicatesSkipped,
      errorsCount,
      errorSummary,
      labels: labelSummaries,
      newLeadIds,
    };
  } catch (error) {
    const errorSummary = error instanceof Error ? error.message : 'Unknown Gmail sync failure';

    await completeSyncRun({
      id: run.id,
      status: 'failed',
      messagesScanned,
      leadsCreated,
      duplicatesSkipped,
      errorsCount: errorsCount + 1,
      errorSummary,
      metadata: { labels: labelSummaries },
    });

    throw error;
  }
}

function extractLeadSignals(subject: string, body: string) {
  const combined = `${subject}\n${body}`;
  const sourceUrlMatch = combined.match(/https?:\/\/www\.upwork\.com\/jobs\/[^\s)]+/i)
    || combined.match(/https?:\/\/www\.upwork\.com\/[^\s)]+/i);

  const budgetMatch = combined.match(/(?:\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:fixed|hour|hr))?)/i)
    || combined.match(/(?:budget|rate)[:\s]+([^\n.]+)/i);

  const knownSkills = [
    'power bi', 'sql', 'dashboard', 'analytics', 'aws', 'python', 'automation', 'terraform',
    'snowflake', 'looker', 'etl', 'excel', 'reporting', 'bigquery', 'dbt', 'docker', 'ci/cd',
  ];

  const lower = combined.toLowerCase();
  const skills = knownSkills.filter((skill) => lower.includes(skill)).slice(0, 8);
  const sourceCompleteness = body.length > 900 ? SourceCompleteness.FULL : SourceCompleteness.PARTIAL;

  return {
    sourceUrl: sourceUrlMatch?.[0],
    budget: budgetMatch?.[0]?.trim(),
    skills,
    sourceCompleteness,
  };
}
