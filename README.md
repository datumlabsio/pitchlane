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
- Vercel Cron (scheduled Gmail sync)
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
