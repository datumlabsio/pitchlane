import { env } from '@/lib/env';

export type SlackLeadPayload = {
  /** 'enriched' = full job fetched; 'private' = invite-only; 'failed' = couldn't fetch. */
  variant: 'enriched' | 'private' | 'failed';
  profileName: string;
  title: string;
  score: number; // match %
  hot: boolean; // score >= the configured "hot" threshold → 🟢, else ⚪
  confidence: string; // 'High' | 'Medium' | 'Low'
  status: string; // 'NEW' | 'QUALIFIED' | …
  budget?: string | null;
  paymentType?: string | null; // 'Hourly' | 'Fixed-price'
  experienceLevel?: string | null; // 'EXPERT' | 'INTERMEDIATE' | 'ENTRY_LEVEL'
  clientLocation?: string | null; // e.g. 'Karachi, Pakistan'
  paymentVerified?: boolean | null;
  skills?: string[] | null;
  matchedKeywords?: string[] | null;
  proposalsCount?: number | null;
  source?: 'upwork_api' | 'bright_data' | null;
  receivedAt?: Date | null;
  leadId: string;
  sourceUrl?: string | null;
};

// Slack section text caps at 3000 chars — keep blocks comfortably under.
function clip(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

// EXPERT → 'Expert level', ENTRY_LEVEL → 'Entry level'.
function prettyExperience(level?: string | null): string | undefined {
  if (!level) return undefined;
  const word = level.replace(/_/g, ' ').toLowerCase();
  const cased = word.charAt(0).toUpperCase() + word.slice(1);
  return /level/.test(cased) ? cased : `${cased} level`;
}

function relativeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Build the Slack message body for a lead alert (pure — no network; exported for tests). */
export function buildLeadAlertBody(payload: SlackLeadPayload): { text: string; blocks: Array<Record<string, unknown>> } {
  const leadUrl = `${env.NEXT_PUBLIC_APP_URL}/leads?leadId=${payload.leadId}`;
  const dot = payload.hot ? '🟢' : '⚪';
  const skills = (payload.skills ?? []).map((s) => s?.trim()).filter(Boolean).slice(0, 6);

  // ── Meta lines (a single section; each line only appears when we have the data) ──
  const meta: string[] = [`*Match ${payload.score}%* · ${payload.confidence} confidence · \`${payload.status}\``];

  if (payload.variant === 'enriched') {
    const budgetLine = [payload.budget, payload.paymentType, prettyExperience(payload.experienceLevel)]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(' · ');
    if (budgetLine) meta.push(`💰 ${budgetLine}`);

    const clientBits: string[] = [];
    if (payload.clientLocation?.trim()) clientBits.push(payload.clientLocation.trim());
    if (payload.paymentVerified === true) clientBits.push('✅ Payment verified');
    else if (payload.paymentVerified === false) clientBits.push('⚠️ Unverified');
    if (clientBits.length) meta.push(`🏢 ${clientBits.join(' · ')}`);

    if (skills.length) meta.push(`🧩 ${skills.join(' · ')}`);
  } else {
    const budgetLine = [payload.budget, payload.paymentType].map((s) => s?.trim()).filter(Boolean).join(' · ');
    if (budgetLine) meta.push(`💰 ${budgetLine}`);
    if (skills.length) meta.push(`🧩 ${skills.join(' · ')}`);
    meta.push(
      payload.variant === 'private'
        ? '🔒 _Invite-only job — Upwork only shows it to the invited account. Enrich from the app if the email has the brief._'
        : '⚠️ _Couldn’t fetch the description automatically — retry from the app._',
    );
  }

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `${dot} *New lead · ${payload.profileName}*\n>${clip(payload.title, 280)}` },
    },
    { type: 'section', text: { type: 'mrkdwn', text: meta.join('\n') } },
  ];

  // ── Footer context (small grey line): keywords · competition · source · age ──
  const footer: string[] = [];
  const kw = (payload.matchedKeywords ?? []).map((k) => k?.trim()).filter(Boolean).slice(0, 6);
  if (kw.length) footer.push(`🔎 ${kw.join(', ')}`);
  if (payload.proposalsCount != null) footer.push(`${payload.proposalsCount} proposals`);
  if (payload.variant === 'enriched' && payload.source) {
    footer.push(payload.source === 'upwork_api' ? 'via Upwork API' : 'via web scrape');
  }
  if (payload.receivedAt) footer.push(relativeAgo(payload.receivedAt));
  if (footer.length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: footer.join('  ·  ') }] });

  // ── Action buttons ──
  const buttons: Array<Record<string, unknown>> = [];
  if (payload.sourceUrl) {
    buttons.push({ type: 'button', text: { type: 'plain_text', text: 'View on Upwork', emoji: true }, url: payload.sourceUrl });
  }
  buttons.push({
    type: 'button',
    text: { type: 'plain_text', text: 'Open in Pitchlane', emoji: true },
    url: leadUrl,
    style: 'primary',
  });
  blocks.push({ type: 'actions', elements: buttons });

  return {
    text: `${dot} New lead for ${payload.profileName} — ${payload.title} (Match ${payload.score}%)`,
    blocks,
  };
}

/** Dead-man's-switch alert: ingestion looks stalled (no successful sync recently). */
export async function notifySlackSyncDown(minutesSince: number | null): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  const since = minutesSince == null ? 'a while (no runs on record)' : `${minutesSince} min`;
  const body = {
    text: `⚠️ Pitchlane ingestion may be down — no successful Gmail sync in ${since}.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Ingestion may be down* — no successful Gmail sync in *${since}*.\nCheck the sync cron and the Google connection in Settings.`,
        },
      },
    ],
  };
  try {
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    // best-effort
  }
}

export async function notifySlackNewLead(payload: SlackLeadPayload): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLeadAlertBody(payload)),
    });
  } catch {
    // Slack notifications are best-effort — never fail the caller.
  }
}
