# Pitchlane Test Cases

## Execution Status

Audit date: `2026-06-16`

Status legend:
- `Passed`: executed successfully during this audit
- `Partially verified`: some assertions were confirmed, but not every expected outcome was exercised end-to-end
- `Code covered`: behavior is implemented in code but not directly executed in this audit
- `Future`: blocked by missing feature

Current results summary:
- `Passed`: `TC-ENV-001`, `TC-ENV-002`, `TC-OAUTH-001`, `TC-OAUTH-003`, `TC-INGEST-001`, `TC-INGEST-002`, `TC-INGEST-003`
- `Partially verified`: `TC-OAUTH-002`, `TC-OAUTH-004`, `TC-EVAL-001`, `TC-UI-001`, `TC-UI-003`, `TC-UI-004`
- `Code covered`: `TC-PROP-001`, `TC-PROP-002`, `TC-PROP-003`, `TC-UI-002`
- `Future`: all sync, lifecycle, profile-editing, and most hardening tests

## 1. Environment and Startup

### TC-ENV-001 App boots locally
- Precondition: env vars are present
- Steps:
  1. Start the app
  2. Open dashboard
- Expected:
  - App loads without server error
  - Dashboard renders metrics and navigation

Current status: `Passed`
Evidence: `pnpm build` succeeded and `/` returned `200` from the running app.

### TC-ENV-002 Database connection works
- Precondition: database URL is valid
- Steps:
  1. Load dashboard and leads page
- Expected:
  - No Prisma initialization error
  - DB-backed data is returned

Current status: `Passed`
Evidence: dashboard, leads, profiles, metrics, and settings all returned live `200` responses; direct Prisma queries returned seeded counts.

## 2. Gmail OAuth

### TC-OAUTH-001 Start Google connect flow
- Steps:
  1. Open settings
  2. Click Connect Gmail
- Expected:
  - User is redirected to Google consent screen

Current status: `Passed`
Evidence: `HEAD /api/auth/google/start` returned `307` to `accounts.google.com`.

### TC-OAUTH-002 Successful callback
- Steps:
  1. Complete Google consent
- Expected:
  - App redirects to settings
  - Success banner is shown
  - Connection status shows connected account email
  - Access/refresh tokens are stored

Current status: `Partially verified`
Evidence: stored Gmail integration exists for `humayun.jawad@datumlabs.io`, and settings shows connected state. This audit did not execute a fresh new OAuth consent-to-success callback because that requires a newly issued Google authorization code.

### TC-OAUTH-003 Missing code
- Steps:
  1. Hit callback route without `code`
- Expected:
  - App redirects to settings with missing-code banner

Current status: `Passed`
Evidence: `HEAD /api/auth/callback/google` returned `307` to `/settings?gmail=missing-code`.

### TC-OAUTH-004 Reused or expired code
- Steps:
  1. Revisit callback URL with same code
- Expected:
  - App redirects to settings with error banner
  - Existing valid connection is not corrupted

Current status: `Partially verified`
Evidence: error-banner rendering is present and previously observed during callback reuse; current settings still shows connected Gmail account, which supports non-corruption. A fresh reused-code replay was not re-executed during this audit.

## 3. Manual Lead Ingestion

### TC-INGEST-001 Create lead from form
- Precondition: at least one seeded label exists
- Steps:
  1. Open leads page
  2. Submit manual ingest form with valid values
- Expected:
  - Lead is created
  - Lead appears in list
  - Evaluation is stored
  - Proposal is stored

Current status: `Passed`
Evidence: posting a valid payload returned `{"ok":true,"duplicate":false,"status":"QUALIFIED"}` and created lead `cmqgh1ffj0001lqw1ydeamt0o` with one evaluation and one proposal.

### TC-INGEST-002 Duplicate lead is ignored
- Steps:
  1. Submit same ingest payload twice
- Expected:
  - Second request returns duplicate response
  - No extra lead is created

Current status: `Passed`
Evidence: replaying the same payload returned `duplicate: true`; lead count remained stable for that dedupe key.

### TC-INGEST-003 Invalid label is rejected
- Steps:
  1. Submit payload with unknown `gmailLabel`
- Expected:
  - API returns 400
  - Clear error message is returned

Current status: `Passed`
Evidence: posting `gmailLabel=unknown-label` returned `{"ok":false,"error":"No active account found for label unknown-label"}`.

### TC-INGEST-004 Invalid source URL is rejected
- Steps:
  1. Submit payload with malformed `sourceUrl`
- Expected:
  - Validation fails
  - API returns 400

Current status: `Not yet executed`
Recommended next step: send a malformed `sourceUrl` payload to confirm Zod validation path.

## 4. Evaluation Logic

### TC-EVAL-001 Strong match qualifies lead
- Steps:
  1. Ingest email containing required skills and keywords
- Expected:
  - Evaluation score meets threshold
  - Lead status becomes Qualified

Current status: `Partially verified`
Evidence: the verified ingestion payload matched `power bi`, `sql`, and `dashboard` and produced status `QUALIFIED`.

### TC-EVAL-002 Reject rule prevents qualification
- Steps:
  1. Ingest email containing a reject term like `telegram`
- Expected:
  - Hard filter fails
  - Lead is not auto-qualified
  - Rejection reason is stored

Current status: `Not yet executed`
Recommended next step: ingest a lead containing `telegram` or `unpaid` against a profile with matching reject rules.

### TC-EVAL-003 Weak email lowers confidence
- Steps:
  1. Ingest very short email body
- Expected:
  - Confidence is Low
  - Summary mentions weak context

Current status: `Not yet executed`
Recommended next step: ingest a very short email body and inspect evaluation summary / confidence label.

### TC-EVAL-004 Partial email still creates lead
- Steps:
  1. Ingest truncated email body
- Expected:
  - Lead is created
  - Source completeness stays Partial
  - Review is still possible

Current status: `Partially verified`
Evidence: the verified lead was created with `sourceCompleteness=PARTIAL`.

## 5. Proposal Generation

### TC-PROP-001 AI proposal is generated
- Precondition: OpenAI key is valid
- Steps:
  1. Ingest a valid lead
- Expected:
  - Proposal text is generated
  - Proposal is stored as primary version

Current status: `Code covered`
Evidence: proposal generation is called during ingestion and the verified lead stored one proposal row. This audit did not distinguish whether the stored text came from live OpenAI output or fallback content.

### TC-PROP-002 Fallback proposal is used on API failure
- Precondition: OpenAI key missing or upstream failure simulated
- Steps:
  1. Ingest a valid lead
- Expected:
  - Request does not fail
  - Fallback proposal is stored

Current status: `Code covered`
Evidence: fallback path is implemented in `src/lib/openai/client.ts`, but not simulated in this audit.

### TC-PROP-003 Proposal reflects profile tone
- Steps:
  1. Ingest one lead for expert-tone profile
  2. Ingest one lead for friendly-tone profile
- Expected:
  - Proposal phrasing differs meaningfully by profile tone

Current status: `Code covered`
Evidence: tone is passed into proposal generation and fallback output changes for `EXPERT` versus non-expert tone. Multi-profile runtime comparison was not executed in this audit.

## 6. UI Data Integrity

### TC-UI-001 Dashboard reflects database state
- Steps:
  1. Create a new lead
  2. Refresh dashboard
- Expected:
  - Lead count changes
  - Recent opportunities list updates

Current status: `Partially verified`
Evidence: dashboard route returns `200` and is DB-backed. This audit created a new lead but did not capture before/after rendered HTML diff for dashboard counts.

### TC-UI-002 Leads page shows latest proposal
- Steps:
  1. Create lead
  2. Open leads page
- Expected:
  - Proposal preview updates to latest primary proposal

Current status: `Code covered`
Evidence: leads page renders `leads[0]?.proposal` from repository data. A rendered-content assertion was not executed in this audit.

### TC-UI-003 Profiles page shows active seeded profiles
- Steps:
  1. Open profiles page
- Expected:
  - All active profiles are listed
  - Threshold, tone, label, and keywords are visible

Current status: `Partially verified`
Evidence: profiles route returns `200`, repository is DB-backed, and seeded profiles exist. A full rendered-content scrape was not performed during this audit.

### TC-UI-004 Metrics page totals match underlying data
- Steps:
  1. Compare DB totals against metrics page
- Expected:
  - Leads, qualified, applied, and connects totals match

Current status: `Partially verified`
Evidence: metrics route returns `200`, and repository logic reads directly from database counts. A rendered-value-to-DB comparison was not executed during this audit.

## 7. Gmail Sync Future Tests

### TC-SYNC-001 Manual Gmail sync ingests labeled messages
- Precondition: Gmail sync is implemented
- Steps:
  1. Trigger sync
- Expected:
  - Only messages under supported labels are processed
  - Leads are created for new messages

Current status: `Future`
Blocker: Gmail sync is not implemented.

### TC-SYNC-002 Repeat sync is idempotent
- Steps:
  1. Run sync twice
- Expected:
  - Previously ingested messages are skipped
  - No duplicate leads appear

Current status: `Future`
Blocker: Gmail sync is not implemented.

### TC-SYNC-003 Message routes to correct account by label
- Steps:
  1. Place different messages under different labels
  2. Run sync
- Expected:
  - Each lead is assigned to the matching account/profile

Current status: `Future`
Blocker: Gmail sync is not implemented.

### TC-SYNC-004 Expired token path
- Steps:
  1. Simulate expired Gmail access token
  2. Run sync
- Expected:
  - Refresh or reconnect path is triggered cleanly
  - Sync failure is recorded, not silent

Current status: `Future`
Blocker: Gmail sync and token refresh handling are not implemented.

## 8. Lead Lifecycle Future Tests

### TC-LIFE-001 Mark lead applied
- Precondition: lifecycle actions exist
- Steps:
  1. Open lead detail
  2. Mark as applied with connects spent
- Expected:
  - Lead status changes to Applied
  - Application record is created/updated
  - Metrics update accordingly

Current status: `Future`
Blocker: lifecycle mutation UI/API is not implemented.

### TC-LIFE-002 Follow-up tracking
- Steps:
  1. Add follow-up date
- Expected:
  - Application record stores follow-up timestamp
  - Lead timeline reflects the event

Current status: `Future`
Blocker: follow-up workflow and timeline UI are not implemented.

### TC-LIFE-003 Outcome tracking
- Steps:
  1. Mark won or lost
- Expected:
  - Lead status updates correctly
  - Event timeline records the change
  - Funnel metrics change accordingly

Current status: `Future`
Blocker: lifecycle mutation UI/API and funnel metrics are not implemented.

## 9. Profile Config Future Tests

### TC-PROFILE-001 Edit threshold
- Precondition: config editor exists
- Steps:
  1. Change threshold for one profile
  2. Ingest matching lead
- Expected:
  - Evaluation uses updated threshold

Current status: `Future`
Blocker: profile config editing is not implemented.

### TC-PROFILE-002 Edit proposal rules
- Steps:
  1. Add custom rule for one profile
  2. Generate proposal
- Expected:
  - Proposal reflects updated rule

Current status: `Future`
Blocker: profile config editing is not implemented.

### TC-PROFILE-003 Isolation between profiles
- Steps:
  1. Change rules for profile A only
  2. Generate lead/proposal for profile B
- Expected:
  - Profile B behavior is unchanged

Current status: `Future`
Blocker: profile config editing is not implemented.

## 10. Regression and Failure Coverage

### TC-REG-001 Existing Gmail connection survives callback errors
- Steps:
  1. Connect Gmail
  2. Hit callback with expired code
- Expected:
  - Existing stored connection remains valid

Current status: `Partially verified`
Evidence: settings still shows a connected Gmail account after prior callback-error handling; no destructive path is present in current callback error branch.

### TC-REG-002 OpenAI outage does not block ingestion
- Steps:
  1. Simulate OpenAI failure
  2. Create lead
- Expected:
  - Lead creation still succeeds with fallback proposal

Current status: `Code covered`
Evidence: `generateProposalDraft` falls back on non-OK OpenAI responses, but outage was not simulated during this audit.

### TC-REG-003 Empty state pages
- Steps:
  1. Run against empty DB
- Expected:
  - Dashboard, leads, profiles, and metrics pages render safe empty states

Current status: `Code covered`
Evidence: empty-state branches exist in page code; empty-database runtime was not exercised during this audit.
