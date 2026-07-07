# Pitchlane

Pitchlane is a multi-profile Upwork lead intelligence app built for forwarded-email intake.

## Core product direction

- One shared Gmail inbox
- Label pattern: `upwork-alerts-[person-name]`
- Email-first evaluation for v1
- Profile-specific filters, scoring, and proposal rules
- Human review before application tracking progresses
- Metrics by profile, source, and outcome

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- Supabase Postgres
- External cron or Vercel Cron (scheduled Gmail sync)
- OpenAI Responses API

## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill the required env vars
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start the app:
   ```bash
   pnpm dev
   ```

## Scheduling

Vercel Hobby does not allow sub-daily `crons` in `vercel.json`, so this repo does not declare built-in Vercel cron jobs.

For production scheduling you have two options:

1. Vercel Pro: add `crons` back to [vercel.json](/Users/mac/Humayun/Personal/n8n ATS/pitchlane/vercel.json) with the desired schedule.
2. Vercel Hobby: use an external scheduler to call these endpoints with `Authorization: Bearer $CRON_SECRET`:
   - `GET /api/integrations/gmail/sync`
   - `GET /api/leads/enrich-pending`

Recommended schedules:

- Gmail sync: every 1 minute
- Lead enrichment: every 5 minutes

The Gmail sync endpoint already checks the database-configured `syncIntervalMinutes` and will skip early runs when the minimum interval has not elapsed.

## Database

The Prisma schema models:

- accounts
- profile configs
- leads
- evaluations
- proposal versions
- applications
- lead events

## Notes

- Business logic lives in `src/domain`
- UI lives in `src/app` and `src/components`
- Email-only evaluation is intentionally confidence-aware to avoid pretending truncated source material is complete
