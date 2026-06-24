export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { Topbar } from '@/components/layout/topbar';
import { GmailSyncForm } from '@/components/settings/gmail-sync-form';
import { listActiveAccounts } from '@/domain/accounts/repository';
import { getGoogleConnectionStatus, getUpworkConnectionStatus } from '@/domain/integrations/repository';
import { env } from '@/lib/env';

type SettingsPageProps = {
  searchParams?: Promise<{ gmail?: string; upwork?: string }>;
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
  const [accounts, google, upwork] = await Promise.all([
    listActiveAccounts(),
    getGoogleConnectionStatus(),
    getUpworkConnectionStatus(),
  ]);
  const params = searchParams ? await searchParams : undefined;
  const gmailStatus = params?.gmail;
  const upworkStatus = params?.upwork;

  return (
    <div className="space-y-8">
      <Topbar title="Settings" subtitle="Integrations, profile routing, and environment." />

      {/* OAuth callback banners */}
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
      {upworkStatus === 'connected' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Upwork connected successfully.
        </div>
      )}
      {upworkStatus === 'error' && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Upwork rejected the callback — confirm the app&apos;s redirect URL matches and try again.
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
                ? 'Synced automatically every minute by a scheduled cron; new leads are enriched in the background.'
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
            slackMinScore={google.slackMinScore}
          />
        </div>
      </div>

      {/* ── Upwork integration ── */}
      <div className="rounded-3xl bg-stone-950 p-6 text-stone-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Upwork integration</p>
            <h2 className="mt-2 text-xl font-semibold">{upwork.connected ? 'Connected' : 'Not connected'}</h2>
            <p className="mt-1 text-sm text-stone-400">
              {upwork.connected
                ? 'Job descriptions and client details come from the official Upwork API (Bright Data is the fallback).'
                : 'Connect Upwork to enrich public jobs via the official API instead of scraping.'}
            </p>
          </div>
          <span className={`mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-medium ${upwork.connected ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
            {upwork.connected ? 'Connected' : 'Pending'}
          </span>
        </div>
        <div className="mt-5 border-t border-white/8 pt-5">
          <Link
            href="/api/integrations/upwork/connect"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-stone-100"
          >
            {upwork.connected ? 'Reconnect Upwork' : 'Connect Upwork'}
          </Link>
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
              <Link
                key={account.id}
                href={`/leads?accountId=${account.id}`}
                className="flex items-center justify-between rounded-2xl border border-stone-900/8 bg-white px-4 py-3 shadow-sm transition hover:border-amber-300 hover:shadow-md"
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
              </Link>
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
            { label: 'Anthropic', ok: !!env.ANTHROPIC_KEY },
            { label: 'Google OAuth', ok: !!env.GOOGLE_CLIENT_ID },
            { label: 'Vercel Cron', ok: !!env.CRON_SECRET },
            { label: 'Slack', ok: !!env.SLACK_WEBHOOK_URL },
            { label: 'Upwork', ok: !!env.UPWORK_CLIENT_ID },
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
