# Pitchlane (SalesFlow) — Team Onboarding for Claude Code

Upwork lead-intelligence platform: ingests job-alert emails, scores them with an LLM judge, drafts proposals, tracks the pipeline, and alerts Slack. Live at **https://pitchlane-eta.vercel.app** · repo `datumlabsio/pitchlane`.

## Stack in one breath

Next.js 16 App Router + TypeScript + Tailwind v4 + base-ui · Prisma → **Supabase Postgres** · Vercel (auto-deploys `main`) · external crons on cron-job.org · LLM judge + proposals on **on-prem LiteLLM** (`gemma-4-12b-it`) with Anthropic fallback · Gmail ingest via **Pub/Sub push** (cron polling as safety net).

## ⚠️ The three rules that actually matter

1. **The database is SHARED between local and prod.** There is no staging DB. Anything you write locally (scripts, Prisma Studio, dev server actions) hits real data the BD team works with. Read freely; write deliberately.
2. **Pushing `main` = deploying prod.** Vercel builds every push. Don't push without checking `pnpm build` + `npx vitest run` first (30–45s each). Convention on this team: get an explicit OK before pushing.
3. **`.env.local` holds production secrets.** Never commit it, never paste values into chat/PRs/logs. Get a copy from Humayun or pull names from `npx vercel env ls` (values via `vercel env pull`).

## Getting running

```bash
git clone https://github.com/datumlabsio/pitchlane && cd pitchlane
pnpm install                 # postinstall runs prisma generate
# → obtain .env.local from Humayun (never committed)
pnpm dev                     # or use .claude/launch.json (pitchlane-dev / prisma-studio)
```

The app sits behind Google sign-in (team accounts only). `pnpm test` runs vitest; schema changes go through `prisma/schema.prisma` + additive SQL (see gotcha below).

### Env vars (names only — values live in Vercel/`.env.local`)

`DATABASE_URL`, `DIRECT_URL`, Supabase trio (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`, `ANTHROPIC_KEY`, `ANTHROPIC_MODEL`, `LLM_PROVIDER` + `LITELLM_BASE_URL/API_KEY/MODEL`, `UPWORK_CLIENT_ID/SECRET`, `BRIGHTDATA_API_TOKEN/ZONE`, `SLACK_WEBHOOK_URL`, `CRON_SECRET`, `GMAIL_PUSH_TOPIC/TOKEN`, `NEXT_PUBLIC_APP_URL`, `CONNECT_RATE_USD`.

## How the pipeline works (read this before touching leads code)

**Email → lead:** Gmail push (Pub/Sub → `/api/integrations/gmail/push`) or the 5-min cron triggers `syncGmailInbox()` — id-diff + 3-layer dedupe (message id, job ciphertext, 45-day repost title). **Lead → verdict:** enrichment fetches the job (Upwork API first, Bright Data fallback), the judge scores it against the profile brief, and triage resolves every lead to QUALIFIED or REJECTED (NEW is transient). **Qualified ⟺ Slack alert** (24h age gate, sibling dedupe, adjustable floor in Settings); every attempt writes a `lead.slack_alerted` receipt in the lead's Activity. Full user-facing manual lives in the app at **`/docs`**.

Key domain files: `src/domain/leads/{enrich-lead,judge-lead,score-lead,create-email-lead}.ts`, `src/domain/integrations/{gmail-sync,gmail-watch}.ts`, `src/lib/ai/proposals.ts`.

## Infrastructure map

| Thing | Where | Notes |
|---|---|---|
| Crons (sync 5-min, enrich-pending, suggest-pending, daily metrics) | cron-job.org | `Authorization: Bearer CRON_SECRET`; sync cron also renews the Gmail watch |
| Gmail push | GCP project `pitchlane-499515` | topic `gmail-lead-push` + push subscription → webhook; watch auto-renews |
| LLM judge + proposals | LiteLLM proxy (on-prem) | no tool-calling on served models → judge uses JSON mode; ~20–40s per call; Anthropic fallback |
| Slack alerts + daily digest | team webhook channel | digest = weekday 4am PKT `daily-upwork-metrics` |
| Assistant knowledge base | Google Drive "Datum Assistant — Knowledge Base" | edits sync to the AI assistants every 15 min |

## Claude Code setup for this repo

- **Dev servers:** `.claude/launch.json` is committed — `pitchlane-dev` (Next, auto-port) and `prisma-studio` (5555). Claude can start them via the preview tools.
- **Connectors (per-person, connect your own):** in Claude settings add **Google Drive** (to read/edit the Datum Assistant KB) and **Slack** if you want Claude posting/reading there. These are personal OAuth connections — nothing to share, each teammate connects once.
- **Useful prompts to steal:** "check the latest sync runs", "why didn't lead X alert Slack" (Activity receipts answer this), "re-run the alert latency report".

## Gotchas that cost us time

- `prisma db push` hangs on the transaction pooler; use the session-pooler URL (port 5432) as `DIRECT_URL`, or apply additive DDL via `$executeRawUnsafe` scripts.
- Client components import enums from `@/domain/enums`, never `@prisma/client`.
- On-prem LiteLLM models don't support tool-calling — the judge asks for bare JSON (see `judge-lead.ts`); don't "fix" it back to tools.
- Cron auto-drafts are intentionally skipped when `LLM_PROVIDER=litellm` (proposals take 60–80s; generate on demand instead).
- `proposalViewed` = the **client** viewed the proposal on Upwork; `buReviewed` = internal review. Don't swap them.
- Never put a sub-daily cron in `vercel.json` — on Hobby it silently fails the whole deploy.
