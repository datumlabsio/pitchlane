import { NextResponse } from 'next/server';

import { listActiveAccounts } from '@/domain/accounts/repository';
import { createAuthenticatedGmailClient } from '@/lib/google/gmail';

export async function POST() {
  try {
    const gmail = await createAuthenticatedGmailClient();
    const accounts = await listActiveAccounts();

    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingByName = new Map(
      (labelsResponse.data.labels ?? []).map((l) => [l.name ?? '', l.id ?? '']),
    );

    const results: Array<{ label: string; action: 'created' | 'exists' }> = [];

    for (const account of accounts) {
      const label = account.gmailLabel;

      if (existingByName.has(label)) {
        results.push({ label, action: 'exists' });
        continue;
      }

      await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: label,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      results.push({ label, action: 'created' });
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
