# Pitchlane Delivery Checklist

## Audit Status

Audit date: `2026-06-16`

Verification legend:
- `Runtime verified`: confirmed through running app, API, or database state
- `Code verified`: confirmed from implementation only
- `Planned`: not implemented yet

Current evidence snapshot:
- `Runtime verified`: `pnpm build` passes, `/`, `/leads`, `/profiles`, `/metrics`, and `/settings` return `200`
- `Runtime verified`: Google OAuth start redirects to Google; missing-code callback redirects to `/settings?gmail=missing-code`
- `Runtime verified`: Gmail connection is stored for `humayun.jawad@datumlabs.io`
- `Runtime verified`: manual ingestion creates a qualified lead, stores evaluation/proposal, and duplicate replay is ignored
- `Runtime verified`: current DB snapshot after verification run is `accounts=5`, `profiles=5`, `leads=4`, `evaluations=4`, `proposals=4`, `applications=2`, `lead_events=1`, `integrations=1`

## Verified Now

- `Runtime verified`: app scaffold exists and runs
- `Runtime verified`: Prisma and Supabase Postgres wiring work against live data
- `Runtime verified`: seed data exists and produced the expected five accounts / five profiles
- `Runtime verified`: Google OAuth routes and settings-state rendering work
- `Runtime verified`: manual ingestion API/UI path works for valid, invalid, and duplicate submissions
- `Runtime verified`: ingestion persists evaluation, proposal, and lead event for newly ingested lead
- `Runtime verified`: app builds successfully
- `Code verified`: current profile/rule schema supports thresholds, tone, snippets, reject rules, and per-profile config data
- `Code verified`: dashboard, leads, profiles, metrics, and settings pages are implemented from DB-backed repositories

## Still Not Verified or Not Built

- `Code verified only`: visual quality items such as “premium SaaS-style layout” and “latest proposal preview is shown” are implemented but not formally UI-reviewed in-browser during this audit
- `Code verified only`: some checked items depend on code presence rather than dedicated runtime assertions, especially around displayed metrics and proposal preview behavior
- `Planned`: all Gmail sync, profile CRUD, lifecycle actions, editable proposal workflow, enrichment, auth, and automated test coverage remain incomplete

## 1. Product Foundation

- [x] Next.js app scaffold exists and runs
- [x] Premium SaaS-style layout exists
- [x] Domain logic is separated from view logic
- [x] Prisma is wired
- [x] Supabase Postgres is wired
- [x] Seed script exists
- [x] Seed data includes the 5 provided Upwork profiles
- [x] Label pattern `upwork-alerts-[person-name]` is modeled
- [ ] App auth / user access model exists
- [ ] Production-safe secret management and rotation is completed

Audit notes:
- `Runtime verified`: app runs and builds successfully
- `Code verified`: layout and architectural separation are present
- `Planned`: auth and secret hygiene are still missing

## 2. Core Data Model

- [x] Accounts model exists
- [x] Profile configs model exists
- [x] Leads model exists
- [x] Lead evaluations model exists
- [x] Proposal versions model exists
- [x] Applications model exists
- [x] Lead events model exists
- [x] Integration connections model exists
- [ ] Gmail message id storage exists
- [ ] Gmail thread id storage exists
- [ ] Sync run tracking model exists
- [ ] Re-evaluation/versioning workflow is defined beyond schema support

Audit notes:
- `Runtime verified`: account, profile, lead, evaluation, proposal, application, and integration tables are populated and queryable
- `Code verified`: lead event table exists and is now exercised by verified manual ingestion
- `Planned`: Gmail message identity and sync-run persistence do not exist yet

## 3. Gmail Integration

- [x] Google OAuth start flow exists
- [x] Google OAuth callback exists
- [x] OAuth callback route mismatch has been fixed
- [x] Gmail tokens are stored in database
- [x] Settings page shows Gmail connection state
- [ ] Gmail message sync from shared inbox exists
- [ ] Label-based Gmail fetch exists
- [ ] Gmail token refresh handling exists
- [ ] Sync error handling exists
- [ ] Manual sync action exists in product UI
- [ ] Scheduled/background sync exists
- [ ] Gmail sync health/status is visible in UI

Audit notes:
- `Runtime verified`: `/api/auth/google/start` returns `307` to Google
- `Runtime verified`: `/api/auth/callback/google` without a code returns `307` to `settings?gmail=missing-code`
- `Runtime verified`: settings page shows connected Gmail state for `humayun.jawad@datumlabs.io`
- `Planned`: Gmail inbox sync, token refresh handling, sync telemetry, and manual/scheduled sync controls do not exist

## 4. Lead Ingestion

- [x] Manual ingestion API exists
- [x] Manual ingestion UI exists
- [x] Deduping exists for manual ingestion
- [x] Lead creation persists evaluation and proposal
- [x] Lead event is recorded on ingestion
- [ ] Gmail-driven ingestion exists
- [ ] Deduping is based on Gmail message identity
- [ ] Parsing of forwarded Upwork email structure is implemented
- [ ] Structured extraction for budget is robust
- [ ] Structured extraction for skills is robust
- [ ] Structured extraction for source URL is robust
- [ ] Structured extraction for project signals is robust

Audit notes:
- `Runtime verified`: invalid label returns `400`
- `Runtime verified`: valid ingestion created lead `cmqgh1ffj0001lqw1ydeamt0o` with status `QUALIFIED`
- `Runtime verified`: duplicate replay returns `duplicate: true`
- `Runtime verified`: the verified lead has one evaluation, one proposal, and one event
- `Planned`: Gmail-driven ingestion and robust Upwork-forward parsing are not implemented

## 5. Lead Evaluation

- [x] Email-first evaluation exists
- [x] Keyword matching exists
- [x] Required skills matching exists
- [x] Reject rules matching exists
- [x] Confidence scoring exists
- [x] Qualification status is assigned from evaluation
- [ ] Scoring weights are actually used in evaluation logic
- [ ] Budget preference is used in evaluation logic
- [ ] Nice-to-have skills are used in evaluation logic
- [ ] JD summary is used in evaluation logic
- [ ] Re-evaluate lead action exists
- [ ] Evaluation explainability UI exists
- [ ] Partial/truncated email warnings are clearly shown per lead

Audit notes:
- `Runtime verified`: verified lead matched `power bi`, `sql`, and `dashboard`, and was marked `QUALIFIED`
- `Code verified`: scoring weights, budget preference, nice-to-have skills, and JD summary are stored in schema/config but are not used by evaluation logic yet
- `Planned`: re-evaluation actions and richer explainability UI are not built

## 6. Proposal Workflow

- [x] AI proposal generation exists
- [x] Fallback proposal generation exists
- [x] Proposal is stored as a proposal version
- [x] Latest proposal preview is shown
- [ ] Proposal regenerate action exists
- [ ] Proposal edit action exists
- [ ] Proposal version history UI exists
- [ ] Proposal approval/review state exists
- [ ] Proposal generation clearly references active profile rules in UI
- [ ] User can customize proposal rules from the app

Audit notes:
- `Runtime verified`: valid ingestion persisted a proposal row alongside the lead
- `Code verified`: proposal preview is rendered from the latest primary proposal on the leads page
- `Planned`: regenerate, edit, version history UI, and approval workflow are not implemented

## 7. Profile and Rules Management

- [x] Profiles page exists
- [x] Seeded profile configuration is displayed
- [x] Schema supports profile-specific thresholds/rules/tone/snippets
- [ ] Account CRUD exists
- [ ] Profile config CRUD exists
- [ ] Editable JD summary exists
- [ ] Editable target roles exists
- [ ] Editable target keywords exists
- [ ] Editable required skills exists
- [ ] Editable nice-to-have skills exists
- [ ] Editable reject rules exists
- [ ] Editable threshold exists
- [ ] Editable proposal tone exists
- [ ] Editable proposal rules exists
- [ ] Editable reusable snippets exists
- [ ] Config versioning UX exists
- [ ] Active/inactive config switching exists

Audit notes:
- `Runtime verified`: profile page loads and seeded profiles are present
- `Code verified`: repositories expose threshold, tone, keywords, and labels from active configs
- `Planned`: there is no CRUD or editing workflow for accounts/configs yet

## 8. Lead Review and Lifecycle

- [x] Lead list page exists
- [x] Status is displayed on leads
- [x] Match score is displayed
- [x] Confidence is displayed
- [ ] Lead detail page exists
- [ ] Reviewer can qualify a lead manually
- [ ] Reviewer can reject a lead manually
- [ ] Reviewer can mark a lead as applied
- [ ] Reviewer can mark client replied
- [ ] Reviewer can mark intro call
- [ ] Reviewer can mark won/lost/closed
- [ ] Lead notes UI exists
- [ ] Lead event timeline UI exists

Audit notes:
- `Runtime verified`: lead list page loads and displays lead summary data
- `Code verified`: status and confidence are rendered in the list
- `Planned`: no lead detail route or lifecycle mutation actions exist

## 9. Application Tracking

- [x] Application model exists
- [x] Connects spent is modeled
- [x] Applied date is modeled
- [x] Follow-up date is modeled
- [x] Notes are modeled
- [ ] Application create/update UI exists
- [ ] Connects spent can be updated from UI
- [ ] Follow-up workflow exists
- [ ] Per-lead application history is visible
- [ ] Outcome tracking is visible in lead detail

Audit notes:
- `Runtime verified`: application data exists in the database for seeded leads
- `Code verified`: connects and applied counts feed metrics repositories
- `Planned`: no UI exists to create/update applications

## 10. Metrics and Reporting

- [x] Dashboard metrics exist
- [x] Metrics page exists
- [x] Per-profile rows exist
- [x] Leads / qualified / applied / connects totals exist
- [ ] Metrics are filterable by date range
- [ ] Funnel metrics exist from received to won/lost
- [ ] Conversion rates by profile exist
- [ ] Trend charts over time exist
- [ ] Gmail sync metrics exist
- [ ] Duplicate/error ingest metrics exist
- [ ] Proposal performance metrics exist

Audit notes:
- `Runtime verified`: dashboard and metrics routes load successfully
- `Code verified`: current metrics are aggregate counts only
- `Planned`: date filtering, funnel reporting, trends, and sync/error analytics are not implemented

## 11. Optional Enrichment

- [ ] Upwork URL enrichment adapter exists
- [ ] Apify integration exists
- [ ] Enrichment is optional and gated
- [ ] Email-only mode remains functional without enrichment
- [ ] Enriched description is clearly distinguished from email-derived data

Audit notes:
- `Planned`: no enrichment adapter or Apify integration exists yet
- `Code verified`: the current product works in email-only mode

## 12. Quality and Hardening

- [x] App builds successfully
- [ ] Unit tests exist for evaluation logic
- [ ] Unit tests exist for ingestion logic
- [ ] Integration tests exist for Gmail OAuth flow
- [ ] Integration tests exist for Gmail sync flow
- [ ] Integration tests exist for proposal generation fallback
- [ ] Error monitoring/logging exists
- [ ] Retry/backoff exists for Gmail and OpenAI calls
- [ ] Rate-limit strategy exists
- [ ] Production deployment checklist is complete

Audit notes:
- `Runtime verified`: `pnpm build` succeeds
- `Code verified`: OpenAI failure falls back in code, but there is no automated test coverage for it
- `Planned`: no test suite, monitoring, retry policy, or deployment hardening checklist exists yet
