import { IntegrationProvider, SourceCompleteness } from '@prisma/client';

import { listActiveAccounts } from '@/domain/accounts/repository';
import { completeSyncRun, createSyncRun, getGoogleConnection } from '@/domain/integrations/repository';
import { createLeadFromEmail } from '@/domain/leads/create-email-lead';
import { createAuthenticatedGmailClient, decodeMessageBody, getHeaderValue } from '@/lib/google/gmail';

const MAX_MESSAGES_PER_LABEL = 10;

type SyncSummary = {
  runId: string;
  status: 'success' | 'partial' | 'failed';
  messagesScanned: number;
  leadsCreated: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errorSummary: string | null;
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

  try {
    const gmail = await createAuthenticatedGmailClient();
    const accounts = await listActiveAccounts();
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labelIdByName = new Map(
      (labelsResponse.data.labels ?? []).map((label) => [label.name ?? '', label.id ?? '']),
    );

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

      const messages = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [resolvedLabelId],
        maxResults: MAX_MESSAGES_PER_LABEL,
      });

      for (const message of messages.data.messages ?? []) {
        if (!message.id) continue;

        perLabel.scanned += 1;
        messagesScanned += 1;

        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
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
          }
        } catch (error) {
          perLabel.errors += 1;
          errorsCount += 1;
          errorMessages.push(`${gmailLabel}: ${error instanceof Error ? error.message : 'Unknown sync error'}`);
        }
      }

      labelSummaries.push(perLabel);
    }

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
