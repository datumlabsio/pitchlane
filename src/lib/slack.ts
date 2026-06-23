import { env } from '@/lib/env';

export type SlackLeadPayload = {
  /** 'enriched' = full description + proposal; 'private' = invite-only, can't fetch. */
  variant: 'enriched' | 'private';
  profileName: string;
  title: string;
  score: number; // match %
  confidence: string; // 'High' | 'Medium' | 'Low'
  budget: string;
  leadId: string;
  sourceUrl?: string | null;
  description?: string; // enriched only
  proposal?: string; // enriched only
};

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

// Slack section text caps at 3000 chars — keep blocks comfortably under.
function clip(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

export async function notifySlackNewLead(payload: SlackLeadPayload): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const leadUrl = `${env.NEXT_PUBLIC_APP_URL}/leads?leadId=${payload.leadId}`;

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🟢 *New lead · ${payload.profileName}*\n>${clip(payload.title, 280)}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Match ${payload.score}%*  ·  Confidence: *${payload.confidence}*  ·  Budget: ${payload.budget}`,
        },
      ],
    },
  ];

  if (payload.variant === 'private') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🔒 *Private / invite-only job* — Upwork only shows it to the invited account, so the description and proposal can’t be fetched automatically. Check the full details on Upwork.',
      },
    });
  } else {
    if (payload.description?.trim()) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*📄 Description*\n${clip(truncateWords(payload.description, 100), 2900)}` },
      });
    }
    if (payload.proposal?.trim()) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*✍️ Proposal*\n${clip(payload.proposal.trim(), 2900)}` },
      });
    }
  }

  const buttons: Array<Record<string, unknown>> = [];
  if (payload.sourceUrl) {
    buttons.push({
      type: 'button',
      text: { type: 'plain_text', text: 'View on Upwork', emoji: true },
      url: payload.sourceUrl,
    });
  }
  buttons.push({
    type: 'button',
    text: { type: 'plain_text', text: 'Open in Pitchlane', emoji: true },
    url: leadUrl,
    style: 'primary',
  });
  blocks.push({ type: 'actions', elements: buttons });

  const body = {
    text: `New lead for ${payload.profileName} — ${payload.title} (Match ${payload.score}%)`,
    blocks,
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Slack notifications are best-effort — never fail the caller.
  }
}
