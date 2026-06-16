import { env } from '@/lib/env';

export type SlackLeadPayload = {
  profileName: string;
  title: string;
  score: number;
  budget: string;
  leadId: string;
};

export async function notifySlackNewLead(payload: SlackLeadPayload): Promise<void> {
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const leadUrl = `${appUrl}/leads?leadId=${payload.leadId}`;

  const body = {
    text: `New qualified lead for *${payload.profileName}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*New qualified lead for ${payload.profileName}*\n>${payload.title}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Score: *${payload.score}* | Budget: ${payload.budget}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View lead' },
            url: leadUrl,
          },
        ],
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Slack notifications are best-effort — don't fail the ingest
  }
}
