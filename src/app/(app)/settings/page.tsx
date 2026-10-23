export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { Topbar } from '@/components/layout/topbar';
import { AlertTuningForm } from '@/components/settings/alert-tuning-form';
import { GmailStandbyControls } from '@/components/settings/gmail-standby-controls';
import { listActiveAccounts } from '@/domain/accounts/repository';
import { getInboundChannelStatus } from '@/domain/integrations/inbound-status';
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

function relativeAgo(date: Date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Chip styling per inbound delivery outcome — mirrors the domain's outcome values.
const OUTCOME_STYLE: Record<string, string> = {
  stored: 'bg-sky-400/15 text-sky-300',
  ingested: 'bg-emerald-400/15 text-emerald-300',
  duplicate: 'bg-stone-400/15 text-stone-300',
  skipped: 'bg-stone-400/10 text-stone-500',
  unroutable: 'bg-amber-400/15 text-amber-300',
  error: 'bg-rose-400/15 text-rose-300',
};

const STAGE_DOT: Record<string, string> = {
  emerald: 'bg-emerald-400',
  sky: 'bg-sky-400',
  amber: 'bg-amber-400',
  stone: 'bg-stone-500',
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [accounts, google, upwork, inbound] = await Promise.all([
    listActiveAccounts(),
    getGoogleConnectionStatus(),
    getUpworkConnectionStatus(),
    getInboundChannelStatus(),
  ]);
  const params = searchParams ? await searchParams : undefined;
  const gmailStatus = params?.gmail;
  const upworkStatus = params?.upwork;

  const live = inbound.mode === 'live';
  const flowing = Boolean(inbound.lastDeliveryAt && Date.now() - inbound.lastDeliveryAt.getTime() < 24 * 3600 * 1000);
  const routedByAccount = new Map(inbound.routedPerAccount.map((r) => [r.accountId, r.count]));

  // Pipeline stage states, derived from real signals only.
  const stages: Array<{ name: string; status: string; tone: keyof typeof STAGE_DOT; pulse?: boolean }> = [
    { name: 'Upwork', status: 'source', tone: 'stone' },
    inbound.armedAt
      ? flowing
        ? { name: 'Forwarding', status: `last ${relativeAgo(inbound.lastDeliveryAt!)}`, tone: 'emerald' }
        : { name: 'Forwarding', status: 'quiet 24h+', tone: 'amber' }
      : { name: 'Forwarding', status: 'waiting', tone: 'stone' },
    inbound.configured
      ? { name: 'Resend', status: 'receiving', tone: 'emerald' }
      : { name: 'Resend', status: 'not configured', tone: 'amber' },
    live
      ? { name: 'Ingest', status: 'live', tone: 'emerald', pulse: true }
      : { name: 'Ingest', status: 'shadow', tone: 'sky' },
    env.SLACK_WEBHOOK_URL
      ? { name: 'Slack', status: 'alerting', tone: 'emerald' }
      : { name: 'Slack', status: 'no webhook', tone: 'amber' },
  ];

  const watchdogFresh = Boolean(
    inbound.reconcileLastRunAt && Date.now() - inbound.reconcileLastRunAt.getTime() < 45 * 60 * 1000,
  );

  return (
    <div className="space-y-8">
      <Topbar title="Settings" subtitle="Mail pipeline, alerts, profile routing, and connections." />

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

      {/* ── Mail pipeline (hero) ── */}
      <div className="rounded-3xl bg-stone-950 p-6 text-stone-50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Mail pipeline</p>
            <h2 className="mt-2 break-all text-xl font-semibold">
              {inbound.receivingAddress ?? 'Inbound channel'}
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              {live
                ? 'Upwork alerts forward from sales@ into the signed webhook — leads ingest with zero Gmail API reads.'
                : inbound.configured
                  ? 'Shadow mode: deliveries are stored and reconciled; Gmail remains the lead source until cutover.'
                  : 'Set the webhook signing secret to activate the forwarding channel.'}
            </p>
          </div>
          <span
            className={`mt-1 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              live ? 'bg-emerald-400/15 text-emerald-300' : inbound.configured ? 'bg-sky-400/15 text-sky-300' : 'bg-amber-400/15 text-amber-300'
            }`}
          >
            {live && <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />}
            {live ? 'Live' : inbound.configured ? 'Shadow mode' : 'Pending'}
          </span>
        </div>

        {/* Stage strip */}
        <div className="mt-5 grid gap-3 rounded-2xl bg-white/6 px-4 py-4 sm:flex sm:items-center sm:gap-0">
          {stages.map((stage, i) => (
            <div key={stage.name} className="flex min-w-0 items-center sm:flex-1">
              <div className="flex items-center gap-2.5">
                <span className={`size-2 shrink-0 rounded-full ${STAGE_DOT[stage.tone]} ${stage.pulse ? 'animate-pulse' : ''}`} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight text-stone-100">{stage.name}</p>
                  <p className="truncate text-[11px] leading-tight text-stone-500">{stage.status}</p>
                </div>
              </div>
              {i < stages.length - 1 && <div className="mx-3 hidden h-px min-w-4 flex-1 bg-white/10 sm:block" />}
            </div>
          ))}
        </div>

        {/* 24h tiles */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Received · 24h', value: inbound.last24h.received, alert: false },
            { label: 'Routed', value: inbound.last24h.routed, alert: false },
            { label: 'Leads created', value: inbound.last24h.leadsCreated, alert: false },
            { label: 'Errors', value: inbound.last24h.errors, alert: inbound.last24h.errors > 0 },
          ].map((m) => (
            <div key={m.label} className="rounded-xl bg-white/6 px-3 py-2.5 text-center">
              <p className={`text-lg font-semibold ${m.alert ? 'text-rose-300' : 'text-white'}`}>{m.value}</p>
              <p className="text-xs text-stone-500">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Recent deliveries */}
        {inbound.recent.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-white/8 pt-4">
            {inbound.recent.slice(0, 5).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${OUTCOME_STYLE[row.outcome] ?? 'bg-stone-400/15 text-stone-300'}`}
                  >
                    {row.outcome}
                  </span>
                  <span className="truncate text-stone-300">{row.subject ?? '(no subject)'}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-stone-500">
                  {row.accountName && <span>{row.accountName}</span>}
                  <span>{relativeAgo(row.receivedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Watchdog */}
        {inbound.configured && inbound.armedAt && (
          <p className="mt-4 text-xs">
            {inbound.reconcileLastRunAt ? (
              watchdogFresh ? (
                <span className="text-stone-500">
                  Watchdog healthy — last ran {formatTimestamp(inbound.reconcileLastRunAt)}.
                </span>
              ) : (
                <span className="text-amber-300">
                  Watchdog has not reported since {formatTimestamp(inbound.reconcileLastRunAt)} — check the reconcile cron.
                </span>
              )
            ) : (
              <span className="text-amber-300">Watchdog has never reported — check the reconcile cron on cron-job.org.</span>
            )}
          </p>
        )}
      </div>

      {/* ── Slack alerts ── */}
      <div className="rounded-3xl border border-stone-900/8 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">Slack alerts</p>
        <p className="mb-4 mt-2 text-sm text-stone-500">
          Tune what the BD channel hears. Applies to every qualified lead, whichever path ingested it.
        </p>
        <AlertTuningForm slackMinScore={google.slackMinScore} slackAlertFloor={google.slackAlertFloor} />
      </div>

      {/* ── Profile routing ── */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
          Profile routing · {accounts.length} active profile{accounts.length !== 1 ? 's' : ''}
        </p>
        {accounts.length === 0 ? (
          <p className="text-sm text-stone-500">No profiles yet — create one from the Profiles page.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const routed = routedByAccount.get(account.id) ?? 0;
              return (
                <Link
                  key={account.id}
                  href={`/leads?accountId=${account.id}`}
                  className="flex flex-wrap items-center justify-between gap-y-2 rounded-2xl border border-stone-900/8 bg-white px-4 py-3 shadow-sm transition hover:border-amber-300 hover:shadow-md"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                      {account.personName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900">{account.personName}</p>
                      <p className="truncate text-xs text-stone-400">{account.forwardingInbox}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        routed > 0 ? 'bg-sky-50 text-sky-700' : 'bg-stone-100 text-stone-400'
                      }`}
                    >
                      {routed > 0 ? `${routed} routed · 24h` : 'quiet · 24h'}
                    </span>
                    <code className="rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-700">
                      {account.gmailLabel}
                    </code>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Connections ── */}
      <div className="rounded-3xl border border-stone-900/8 bg-white p-6 shadow-sm">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-stone-400">Connections</p>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-900/6 py-4">
          <div className="flex items-center gap-3">
            <span className={`size-2 rounded-full ${google.connected ? (live ? 'bg-stone-400' : 'bg-emerald-400') : 'bg-amber-400'}`} />
            <div>
              <p className="text-sm font-medium text-stone-900">
                Gmail{google.email ? ` · ${google.email}` : ''}
              </p>
              <p className="text-xs text-stone-400">
                {live
                  ? google.connected
                    ? 'Standby rollback path — scheduled syncs off, push watch stopped.'
                    : 'Retired. No Google credentials in use.'
                  : google.connected
                    ? 'Primary ingestion path, synced by the scheduled cron.'
                    : 'Connect the shared forwarding inbox to enable Gmail sync.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                live
                  ? 'bg-stone-100 text-stone-500'
                  : google.connected
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {live ? (google.connected ? 'Standby' : 'Retired') : google.connected ? 'Connected' : 'Pending'}
            </span>
            {google.connected && <GmailStandbyControls connected={google.connected} />}
            <Link
              href="/api/auth/google/start"
              className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
            >
              {google.connected ? 'Reconnect' : 'Connect'}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <span className={`size-2 rounded-full ${upwork.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <div>
              <p className="text-sm font-medium text-stone-900">Upwork API</p>
              <p className="text-xs text-stone-400">
                {upwork.connected
                  ? 'Job and client enrichment via the official API (Bright Data fallback).'
                  : 'Connect to enrich public jobs via the official API instead of scraping.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                upwork.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {upwork.connected ? 'Connected' : 'Pending'}
            </span>
            <Link
              href="/api/integrations/upwork/connect"
              className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
            >
              {upwork.connected ? 'Reconnect' : 'Connect'}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Environment ── */}
      <div className="rounded-2xl border border-stone-900/8 bg-stone-50 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-stone-400">Environment</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Supabase', ok: !!env.NEXT_PUBLIC_SUPABASE_URL },
            { label: 'Anthropic', ok: !!env.ANTHROPIC_KEY },
            { label: 'Google OAuth', ok: !!env.GOOGLE_CLIENT_ID },
            { label: 'Cron secret', ok: !!env.CRON_SECRET },
            { label: 'Slack', ok: !!env.SLACK_WEBHOOK_URL },
            { label: 'Resend inbound', ok: !!env.RESEND_INBOUND_WEBHOOK_SECRET && !!env.RESEND_API_KEY },
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
