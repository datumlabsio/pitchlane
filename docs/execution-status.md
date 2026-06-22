# Pitchlane Execution Status

Updated: `2026-06-16`

## Summary

This document is the current execution snapshot for the delivery checklist.

Status legend:
- `Done`: implemented and at least code-verified
- `Verified`: implemented and exercised through runtime/API/build verification
- `Partial`: implemented with an explicit gap still remaining
- `Pending`: not implemented yet
- `Blocked`: implementation exists but depends on external setup or follow-up work

## Done / Verified

### Product foundation
- `Verified` Next.js app scaffold exists and runs
- `Verified` Prisma is wired
- `Verified` Supabase Postgres is wired
- `Verified` seed data exists for 5 Upwork profiles
- `Verified` label pattern `upwork-alerts-[person-name]` is modeled
- `Done` business logic is separated from the view layer
- `Verified` `pnpm build` succeeds after the latest integration pass

### Gmail integration
- `Verified` Google OAuth start flow exists
- `Verified` Google OAuth callback exists
- `Verified` callback route mismatch is fixed
- `Verified` Gmail tokens are stored in database
- `Verified` settings page shows Gmail connection state
- `Done` manual Gmail sync endpoint exists at `/api/integrations/gmail/sync`
- `Done` sync-run tracking exists in code and database schema
- `Done` settings page shows latest sync summary and exposes a manual sync action
- `Done` Gmail message-level dedupe support exists via `externalMessageId`

### Lead ingestion and evaluation
- `Verified` manual ingestion API exists
- `Verified` manual ingestion UI exists
- `Verified` deduping works for manual ingestion
- `Verified` lead creation persists evaluation and proposal
- `Verified` lead event is recorded on ingestion
- `Verified` keyword matching exists
- `Verified` required skills matching exists
- `Verified` reject-rule matching exists
- `Verified` confidence scoring exists
- `Verified` qualification status is assigned from evaluation

### Proposal workflow
- `Done` AI proposal generation exists
- `Done` fallback proposal generation exists
- `Verified` proposal is stored as a proposal version
- `Done` latest proposal preview is shown
- `Done` proposal regenerate API exists
- `Done` proposal edit/version-save API exists
- `Done` proposal versions are persisted chronologically with primary switching

### Profile and account management
- `Done` profiles page is now editable instead of read-only
- `Done` account settings PATCH API exists
- `Done` profile-config PATCH API exists
- `Done` editable fields now include:
  - Gmail label
  - forwarding inbox
  - notification email
  - account active state
  - profile active state
  - role focus
  - JD summary
  - target roles
  - target keywords
  - required skills
  - nice-to-have skills
  - reject rules
  - threshold
  - proposal tone
  - proposal rules
  - reusable snippets

### Lead lifecycle and application tracking
- `Done` lead workbench exists on `/leads`
- `Done` lead detail/review experience exists within the split-pane workbench
- `Done` lifecycle status update API exists
- `Done` supported lifecycle actions include:
  - qualified
  - rejected
  - applied
  - client replied
  - intro call
  - won
  - lost
  - closed
- `Done` application upsert API exists
- `Done` application editing supports:
  - connects spent
  - applied at
  - last follow-up at
  - notes
- `Done` proposal actions are available from the lead workbench

### Metrics and reporting
- `Verified` dashboard metrics exist
- `Verified` metrics page exists
- `Verified` per-profile rows exist
- `Verified` leads / qualified / applied / connects totals exist

## Partial

### Gmail integration
- `Partial` Gmail sync is implemented, but the live sync run currently fails because the expected Gmail labels are not present in the connected inbox
- `Partial` Gmail token refresh handling relies on Google client credential refresh behavior; there is no explicit refresh-health UI or recovery workflow yet
- `Partial` Gmail sync health is visible only through latest-run summary, not a full operational history page

### Lead ingestion and parsing
- `Partial` Gmail-driven ingestion infrastructure exists, but has not yet successfully created live leads because labels are missing in Gmail
- `Partial` source URL / budget / skills extraction exists with lightweight heuristics, not robust forwarded-email parsing
- `Partial` source completeness is tracked, but partial/truncated email warnings are still basic

### Proposal workflow
- `Partial` proposal versioning exists, but there is no explicit “restore older version” action
- `Partial` proposal generation uses active profile rules in backend input, but the UI does not yet clearly explain which rules were applied to a generated draft

### Profile and rules management
- `Partial` active config can be edited, but config versioning UX is not implemented
- `Partial` there is no “create new profile config version” flow
- `Partial` there is no “create config for account with no config” flow

### Lead workflow
- `Partial` lead detail exists inside `/leads`, not as a dedicated `/leads/[leadId]` route
- `Partial` event storage exists, but event timeline presentation needs refinement and broader event coverage

## Pending

### Product / security / hardening
- `Pending` app auth / user access model
- `Pending` production-safe secret rotation and cleanup
- `Pending` error monitoring/logging
- `Pending` retry/backoff policy for Gmail and OpenAI calls
- `Pending` rate-limit strategy
- `Pending` production deployment checklist

### Evaluation improvements
- `Pending` scoring weights are not used in evaluation logic
- `Pending` budget preference is not used in evaluation logic
- `Pending` nice-to-have skills are not used in evaluation logic
- `Pending` JD summary is not used in evaluation logic
- `Pending` explicit re-evaluate lead action
- `Pending` richer evaluation explainability UI

### Lead and application workflow
- `Pending` dedicated lead detail route if required
- `Pending` lifecycle transition rules / guardrails server-side
- `Pending` follow-up-specific lifecycle action (`FOLLOW_UP`) if desired in product flow
- `Pending` explicit outcome tracking views beyond current workbench state controls

### Metrics and reporting
- `Pending` date-range filtering
- `Pending` funnel metrics from received to won/lost
- `Pending` conversion reporting by profile over time
- `Pending` trend charts
- `Pending` duplicate/error ingest metrics presentation
- `Pending` proposal performance metrics

### Enrichment
- `Pending` Upwork URL enrichment adapter
- `Pending` Apify integration
- `Pending` explicit separation of enriched data vs email-derived data in UI

### Test automation
- `Pending` unit tests for evaluation logic
- `Pending` unit tests for ingestion logic
- `Pending` integration tests for Gmail OAuth
- `Pending` integration tests for Gmail sync
- `Pending` integration tests for proposal fallback behavior

## Blocked / Needs External Setup

- `Blocked` live Gmail sync success depends on creating the expected labels in the connected Gmail inbox:
  - `upwork-alerts-humayun`
  - `upwork-alerts-faizan`
  - `upwork-alerts-muhammad-s`
  - `upwork-alerts-nidal`
  - `upwork-alerts-hadiqa`
- `Blocked` any production rollout depends on rotating the exposed secrets already used during development

## Latest Verification Snapshot

- `Verified` build output includes:
  - `/api/accounts/[accountId]`
  - `/api/profile-configs/[profileConfigId]`
  - `/api/applications`
  - `/api/leads/[leadId]/status`
  - `/api/leads/[leadId]/proposals`
  - `/api/integrations/gmail/sync`
- `Verified` manual ingestion created and deduped a verification lead successfully
- `Verified` Gmail sync endpoint executed and recorded a sync run
- `Verified` latest sync run failed due missing Gmail labels, not due server crash

## Recommended Next Execution Order

1. Create the Gmail labels in the connected inbox and rerun sync
2. Execute the remaining current test cases that are now implementable
3. Add automated tests for evaluation, ingestion, and lifecycle routes
4. Improve evaluation logic to use scoring weights, budget preferences, and nice-to-have skills
5. Add config versioning and richer metrics/reporting
