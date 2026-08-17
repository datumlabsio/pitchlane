import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  ANTHROPIC_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  // Which LLM writes proposals: "anthropic" (default) or "litellm" (on-prem,
  // OpenAI-compatible LiteLLM proxy). Anthropic stays wired so we can switch back.
  LLM_PROVIDER: z.string().optional(),
  LITELLM_BASE_URL: z.string().optional(),
  LITELLM_API_KEY: z.string().optional(),
  LITELLM_MODEL: z.string().default("smart"),
  UPWORK_CLIENT_ID: z.string().optional(),
  UPWORK_CLIENT_SECRET: z.string().optional(),
  // Must exactly match the single Callback URL registered on the Upwork app.
  // Falls back to NEXT_PUBLIC_APP_URL + the callback path when unset.
  UPWORK_REDIRECT_URI: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  // USD per Upwork connect for digest spend estimates (boosts skew real cost).
  CONNECT_RATE_USD: z.coerce.number().positive().default(0.15),
  CRON_SECRET: z.string().optional(),
  // Gmail push (Pub/Sub): full topic name + the shared token the webhook validates.
  GMAIL_PUSH_TOPIC: z.string().optional(),
  GMAIL_PUSH_TOKEN: z.string().optional(),
  // Robust Gmail auth: base64 of a service-account key JSON + the Workspace mailbox
  // it impersonates (domain-wide delegation). When both are set, Gmail access no
  // longer depends on anyone's OAuth login/password. GMAIL_CONNECT_ALLOWED locks the
  // Settings connect flow to one mailbox so a stray login can't clobber the connection.
  GOOGLE_SA_KEY_B64: z.string().optional(),
  GMAIL_IMPERSONATE: z.string().optional(),
  GMAIL_CONNECT_ALLOWED: z.string().optional(),
  ZENROWS_API_KEY: z.string().optional(),
  BRIGHTDATA_API_TOKEN: z.string().optional(),
  BRIGHTDATA_ZONE: z.string().optional(),
  LEAD_ENRICHMENT_ENABLED: z.string().optional(),
  DEFAULT_FORWARDING_INBOX: z.string().email().default("humayun.jawad@datumlabs.io"),
  DEFAULT_NOTIFICATION_EMAIL: z.string().email().default("humayun.jawad@datumlabs.io"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  ANTHROPIC_KEY: process.env.ANTHROPIC_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  LITELLM_BASE_URL: process.env.LITELLM_BASE_URL,
  LITELLM_API_KEY: process.env.LITELLM_API_KEY,
  LITELLM_MODEL: process.env.LITELLM_MODEL,
  UPWORK_CLIENT_ID: process.env.UPWORK_CLIENT_ID,
  UPWORK_CLIENT_SECRET: process.env.UPWORK_CLIENT_SECRET,
  UPWORK_REDIRECT_URI: process.env.UPWORK_REDIRECT_URI,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  CONNECT_RATE_USD: process.env.CONNECT_RATE_USD,
  CRON_SECRET: process.env.CRON_SECRET,
  GMAIL_PUSH_TOPIC: process.env.GMAIL_PUSH_TOPIC,
  GMAIL_PUSH_TOKEN: process.env.GMAIL_PUSH_TOKEN,
  GOOGLE_SA_KEY_B64: process.env.GOOGLE_SA_KEY_B64,
  GMAIL_IMPERSONATE: process.env.GMAIL_IMPERSONATE,
  GMAIL_CONNECT_ALLOWED: process.env.GMAIL_CONNECT_ALLOWED,
  ZENROWS_API_KEY: process.env.ZENROWS_API_KEY,
  BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN,
  BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
  LEAD_ENRICHMENT_ENABLED: process.env.LEAD_ENRICHMENT_ENABLED,
  DEFAULT_FORWARDING_INBOX: process.env.DEFAULT_FORWARDING_INBOX,
  DEFAULT_NOTIFICATION_EMAIL: process.env.DEFAULT_NOTIFICATION_EMAIL,
});
