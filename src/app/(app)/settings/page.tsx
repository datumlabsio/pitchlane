export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { Topbar } from '@/components/layout/topbar';
import { GmailSyncForm } from '@/components/settings/gmail-sync-form';
import { listActiveAccounts } from '@/domain/accounts/repository';
import { getGoogleConnectionStatus } from '@/domain/integrations/repository';
import { env } from '@/lib/env';

type SettingsPageProps = {
  searchParams?: Promise<{ gmail?: string }>;
};

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [accounts, google] = await Promise.all([
    listActiveAccounts(),
    getGoogleConnectionStatus(),
  ]);
  const params = searchParams ? await searchParams : undefined;
  const gmailStatus = params?.gmail;

  return (
    <div className="space-y-8">
      <Topbar title="Settings" subtitle="Gmail integration, profile routing, and environment." />

      {/* OAuth callback banner */}
      {gmailStatus === 'connected' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Gmail connected successfully.
        </div>
      )}
      {gmailStatus === 'error' && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Google rejected the callback — the code may have expired. Start the connect flow again.
        </div>
      )}

      {/* ── Gmail integration ── */}
      <div className="rounded-3xl bg-stone-950 p-6 text-stone-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Gmail integration</p>
            <h2 className="mt-2 text-xl font-semibold">
              {google.connected
                ? `Connected as ${google.email ?? 'unknown'}`
                : 'Not connected'}
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              {google.connected
                ? 'Auto-syncs every 5 minutes in production via Vercel Cron.'
                : 'Connect the shared forwarding inbox to enable Gmail sync.'}
            </p>
          </div>
          <span className={`mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-medium ${google.connected ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
            {google.connected ? 'Connected' : 'Pending'}
          </span>
        </div>

        {/* Latest sync stats */}
        {google.latestSync && (
          <div className="mt-5 rounded-2xl bg-white/6 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-stone-300">Latest sync</p>
              <p className="text-xs text-stone-500">
                {formatTimestamp(google.latestSync.startedAt)}
                {google.latestSync.finishedAt ? ` → ${formatTimestamp(google.latestSync.finishedAt)}` : ''}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { label: 'Scanned', value: google.latestSync.messagesScanned },
                { label: 'Created', value: google.latestSync.leadsCreated },
                { label: 'Dupes', value: google.latestSync.duplicatesSkipped },
                { label: 'Errors', value: google.latestSync.errorsCount },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-white/6 px-3 py-2 text-center">
                  <p className="text-lg font-semibold text-white">{m.value}</p>
                  <p className="text-xs text-stone-500">{m.label}</p>
                </div>
              ))}
            </div>
            {google.latestSync.errorSummary && (
              <p className="mt-2 text-xs text-amber-300">{google.latestSync.errorSummary}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 space-y-3 border-t border-white/8 pt-5">
          <div className="flex items-center gap-3">
            <Link
              href="/api/auth/google/start"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-stone-100"
            >
              {google.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
            </Link>
            {google.email && (
              <span className="text-xs text-stone-500">{google.email}</span>
            )}
          </div>
          <GmailSyncForm
            connected={google.connected}
            hasModifyScope={google.scopes.includes('https://www.googleapis.com/auth/gmail.modify')}
            syncIntervalMinutes={google.syncIntervalMinutes}
          />
        </div>
      </div>

      {/* ── Label routing ── */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
          Label routing · {accounts.length} active profile{accounts.length !== 1 ? 's' : ''}
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-stone-500">No profiles yet — create one from the Profiles page.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-2xl border border-stone-900/8 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                    {account.personName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-900">{account.personName}</p>
                    <p className="text-xs text-stone-400">{account.forwardingInbox}</p>
                  </div>
                </div>
                <code className="rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  {account.gmailLabel}
                </code>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Environment ── */}
      <div className="rounded-2xl border border-stone-900/8 bg-stone-50 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-stone-400">Environment</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Supabase', ok: !!env.NEXT_PUBLIC_SUPABASE_URL },
            { label: 'OpenAI', ok: !!env.OPENAI_API_KEY },
            { label: 'Google OAuth', ok: !!env.GOOGLE_CLIENT_ID },
            { label: 'Trigger.dev', ok: !!env.TRIGGER_SECRET_KEY },
            { label: 'Slack', ok: !!env.SLACK_WEBHOOK_URL },
          ].map(({ label, ok }) => (
            <span
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-50 text-rose-600'}`}
            >
              {ok ? '✓' : '✗'} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
