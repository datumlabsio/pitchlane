import { env } from '@/lib/env';

export type ReceivedEmailDetail = {
  id: string;
  from: string | null;
  to: string[] | null;
  cc: string[] | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  headers: Record<string, string> | null;
  received_for: string[] | null;
  message_id: string | null;
  created_at: string;
};

// Minimal REST client for the one call the inbound path needs. The webhook event
// only carries metadata — the parsed body lives behind this endpoint.
export async function getReceivedEmail(id: string): Promise<ReceivedEmailDetail> {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const response = await fetch(`https://api.resend.com/emails/receiving/${id}`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  if (!response.ok) {
    throw new Error(`Resend received-email fetch failed (${response.status}) for ${id}`);
  }
  return (await response.json()) as ReceivedEmailDetail;
}
