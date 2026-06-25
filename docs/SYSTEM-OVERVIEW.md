# SalesFlow — System Overview

_What we're running right now. Last updated: 2026-06-24._

SalesFlow is a multi-profile Upwork lead-intelligence and proposal tool. It ingests
Upwork job-alert emails, enriches each job from the official Upwork API, scores it
against per-profile rules, drafts a proposal for promising leads, and posts a Slack
alert — then gives you a workbench to triage, filter, and manage the pipeline.

---

## 1. Tech stack

| Layer | What we use | Version |
|---|---|---|
| Framework | Next.js (App Router) + React | 16.2.9 / 19.2.4 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS + base-ui components | 4.3.1 / @base-ui/react 1.5.0 |
| Charts | Recharts | 3.8.0 |
| ORM | Prisma | 6.9.0 |
| Database | Supabase Postgres (transaction pooler, port 6543) | — |
| Auth (app) | Supabase Auth (Google sign-in) | @supabase/ssr 0.12.0 |
| AI SDK | `@anthropic-ai/sdk` | 0.105.0 |
| Google APIs | `googleapis` (Gmail) | 173.0.0 |
| Validation | Zod | 4.4.3 |
| Hosting | Vercel (region `sin1`) | — |
| Scheduling | cron-job.org (external) | — |
| Repo | `github.com/datumlabsio/pitchlane` · prod `pitchlane-eta.vercel.app` | — |

---

## 2. How a lead flows through the system

```
Upwork saved-search "New job alert" email
        │
        ▼  (Gmail, filtered into a per-profile label)
Gmail sync cron — every 1 min → /api/integrations/gmail/sync
        │   • reads new labeled emails
        │   • createLeadFromEmail: dedupe, rule-based score, status NEW/QUALIFIED
        ▼
Inline enrichment (Next.js after(), right after the sync responds)
        │   • enrichLead per new lead with a job URL
        │   • Upwork API direct-fetch  →  Bright Data scrape (fallback)
        │   • re-score on the full description
        │   • write a proposal ONLY if the lead clears the qualify score
        ▼
Slack alert  (🟢 hot / ⚪ otherwise) — fires within seconds of the email landing
        │
        ▼
Lead workbench (UI): filter, search, lifecycle, proposal edit/regenerate, metrics
```

Two safety nets run alongside:
- **enrich-pending cron** (~10–15 min): re-tries any lead the inline path missed (only leads older than 5 min, so it never races the inline path).
- **heartbeat cron** (~5–10 min): Slack ping if there's been no successful sync in 15 min.

**Scoring is rule-based** (`evaluateEmail`) — skills/roles/keywords/budget matching, no LLM. The only AI cost is proposal drafting.

---

## 3. Integrations

### Gmail (ingestion)
- OAuth-connected; reads job-alert emails filtered into a per-profile Gmail label (`pitchlane/<name>`).
- The job URL, budget, and skills are extracted from each email at ingest.

### Upwork API (enrichment — primary)
- **GraphQL**, OAuth2 (authorization-code flow), **public marketplace scope only**.
- **Direct fetch by job id** (the `~02…` ciphertext from the job URL, minus the `~02` prefix) returns: full description, budget (incl. **hourly ranges**), experience level, **payment-verified**, client country/city.
- **No real-time feed/webhook** — request/response only. Our trigger is the Gmail alert email; the API enriches it.
- **Rate limit ≈ 10–100 requests/hour** (tight). We use ~1 call per lead, enrich sequentially, and fall back to the scraper on any error — so a limit hit degrades gracefully.
- **Cost: free** (just OAuth).
- Not available on this scope: authenticated search, client total-spend/hires, skill names via direct fetch (we use the email's skills instead).

### Bright Data Web Unlocker (enrichment — fallback)
- Used only when the API can't fetch a job (invite-only / closed / not found). Renders the public Upwork page (~45–75s) and parses description + client stats.
- **Cost: per request** — minimal now that the API handles the common path.

### Anthropic / Claude (proposal drafting)
- **Model: `claude-sonnet-4-6`** (set via `ANTHROPIC_MODEL`). `max_tokens: 4096`, adaptive thinking, streaming.
- Only runs for leads **at/above the qualify score** (cost control) and on-demand from the proposal tab.
- **Cost: ~3–8¢ per proposal** → realistically **~$1–8/day** at ~100 leads/day. (See §5.)

### Slack (alerts)
- Incoming webhook. **Meta-only** alert: match %, confidence tier (derived from the score), budget, client + payment-verified, skills, matched keywords, source, age.
- A **🟢/⚪ dot** flags whether the score clears the "hot" threshold (the relabeled `slackMinScore` setting). Fires for **every** lead. Also pings on private/closed and on sync-down (dead-man's-switch).

---

## 4. Background jobs (cron-job.org → prod endpoints, Bearer `CRON_SECRET`)

| Job | Endpoint | Cadence |
|---|---|---|
| Gmail sync (+ inline enrich + alert) | `/api/integrations/gmail/sync` | every 1 min |
| Enrich safety-net | `/api/leads/enrich-pending` | ~10–15 min |
| Sync heartbeat (dead-man's-switch) | `/api/health/sync-heartbeat` | ~5–10 min |

---

## 5. Costs (current)

| Service | Model | Realistic spend |
|---|---|---|
| Upwork API | OAuth, public scope | **Free** |
| Anthropic (Sonnet 4.6) | $3 / $15 per 1M in/out | **~$1–8/day** (proposals only; gated by score) |
| Bright Data | per Web Unlocker request | small — fallback only |
| Supabase / Vercel / cron-job.org | platform plans | per plan |

**Spend safeguards:** score-gating (no proposals for low-fit leads), `max_tokens` cap per call, and a hard ceiling available via an **Anthropic Console spend limit**. For heavy testing, switch `ANTHROPIC_MODEL=claude-haiku-4-5` ($1/$5) to make test spend trivial. Hitting $100/day would take ~1,500–3,000 proposals — not reachable at normal volume.

**Model options if we ever want to change:** Haiku 4.5 ($1/$5, cheapest/fastest), **Sonnet 4.6 (current — best balance)**, Opus 4.8 ($5/$25, highest quality).

---

## 6. Key features

- **Lead workbench**: list + side panel; lifecycle status controls sit above the tabs (reachable from any tab).
- **Filters**: searchable multi-select **Profiles** + **Status**, **date range** — on the leads list, dashboard, and metrics.
- **Search**: spans title, subject, body, sender, job URL, and enriched description; **paste a job URL** (any form) to find that exact lead.
- **Proposals**: auto-drafted for qualified leads; on-demand "Generate a proposal" / "Regenerate" / "Rewrite with feedback"; version history; copy.
- **Enrichment labels**: badges show how a job was fetched (via Upwork API / via web scrape) and its state (full description / private / closed).
- **Metrics**: pipeline funnel, qualification/apply/win rates, per-profile performance — all profile-filterable.

---

## 7. Known limitations

- Upwork's public scope can't tell **private** from **closed** (both 404) — we label such jobs "private / no longer available."
- No client total-spend/hires from the API (masked); only the Bright Data scrape gets those.
- Upwork rate limit is the main external constraint; current volume is comfortably under it.
- Vercel function time caps the inline-enrichment batch; anything that spills is caught by the safety-net cron.
