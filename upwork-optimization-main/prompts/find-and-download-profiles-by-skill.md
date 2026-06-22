# Task: Find and download Upwork profiles by keyword

<!-- Version: 7 (updated from v6) -->
<!-- v7 changes:
     (1) Output records the input keywords (new `input_keywords` field + per-profile `matched_keyword`).
     (2) Languages captured in a readable "Language (Proficiency)" format (never a raw "Language: Proficiency" colon).
     (3) Added a 20-second delay after each keyword search (before reading results), applied for every keyword. -->

## Inputs (Langfuse variables — values injected at compile time; defaults apply when a variable is blank)
- KEYWORDS = {{KEYWORDS}} ← the search terms (e.g. "n8n", "react native developer", "shopify expert"). REQUIRED.
- MAX_PROFILES = {{MAX_PROFILES}} ← how many NEW profiles to collect this run (default 20 if blank)
- MIN_HOURLY_RATE = {{MIN_HOURLY_RATE}} ← minimum hourly rate in USD (default 40 if blank)
- LOCATIONS = {{LOCATIONS}} ← Upwork loc slugs, comma-separated (default "americas,europe" if blank). Region slugs cover whole continents; country slugs also work (see below).
- TOP_RATED_PLUS = {{TOP_RATED_PLUS}} ← restrict to Top Rated Plus badge only (default "yes" if blank)
- MAX_HISTORY_PAGES= {{MAX_HISTORY_PAGES}} ← how many pages of work history / portfolio to capture per profile (default 1 if blank)
- OUTPUT_DIR = {{OUTPUT_DIR}} ← folder to save .md files (default ./upwork-profiles if blank)

## Objective
Search Upwork for freelancer profiles matching KEYWORDS that are based in LOCATIONS, charge at least MIN_HOURLY_RATE, and (if TOP_RATED_PLUS=yes) hold the Top Rated Plus badge. Open each result, extract the full profile, and save ONE markdown file per profile. Do not stop until you have collected MAX_PROFILES NEW profiles or you run out of results. Never re-download a profile that already exists in OUTPUT_DIR.

## Search URL (use this exact filtered format — do NOT use the bare keyword search)
Build the talent-search URL by substituting the inputs:

https://www.upwork.com/nx/search/talent/?q={{KEYWORDS}}&hourly_rate={{MIN_HOURLY_RATE}}-*&loc={{LOCATIONS}}&top_rated_plus={{TOP_RATED_PLUS}}

Canonical default example (KEYWORDS=n8n, MIN_HOURLY_RATE=40, LOCATIONS=americas,europe, TOP_RATED_PLUS=yes):
https://www.upwork.com/nx/search/talent/?q=n8n&hourly_rate=40-*&loc=americas,europe&top_rated_plus=yes

Parameter rules (verified against Upwork's live talent search):
- q = URL-encoded KEYWORDS (e.g. q=n8n, q=react%20native%20developer).
- hourly_rate = "<MIN_HOURLY_RATE>-*" sets the MINIMUM hourly rate with no upper bound. The "*" is the open-ended max (it may appear URL-encoded as %2a; either form works). Example for $40+: hourly_rate=40-*
- loc = comma-separated, order-insensitive. Two kinds of slug are accepted:
• REGION slugs (broad): "americas" (North, Central & South America — includes US, Canada, and Latin America) and "europe" (European countries). Default LOCATIONS = "americas,europe".
• COUNTRY slugs (narrow): the country name lowercased with spaces→hyphens, e.g. united-states, canada, united-kingdom, germany, france, netherlands, ireland, spain, italy, sweden, switzerland. Use these instead of regions when you need a tighter geography.
NOTE: "americas" includes Latin America, not just US/Canada. If you must restrict to US + Canada only, set loc=united-states,canada instead.
- top_rated_plus= "yes" restricts results to the Top Rated Plus badge (Upwork's highest-tier freelancers). Omit the param or set "no" to include everyone.

If you are ever unsure of a slug, open the talent search, click the Location filter ("City, country or region"), type the place and tick it — Upwork writes the correct slug into the loc= URL param, which you can then reuse.

## Deduplication against existing files (do this BEFORE collecting)
- Before searching, scan OUTPUT_DIR for existing profile files (*.md). For each, read its canonical profile URL (the `url:` frontmatter field) and extract the ~01 id. Build an ALREADY_SAVED set of these ids (also include the id embedded in each filename as a fallback).
- A profile is a DUPLICATE if its canonical ~01 id is in ALREADY_SAVED. Never open, overwrite, or re-save a duplicate.
- Dedupe is keyed on the canonical ~01 profile id / url — NOT on the display name or the vanity-slug URL (profiles redirect to vanity handles).

## Procedure (follow in order)
1. Build the ALREADY_SAVED set from OUTPUT_DIR (see Deduplication above). Then go to the filtered search URL (talent / freelancer search — NOT job search). Confirm the rate, location, and Top Rated Plus filter chips are applied before reading results. If you land on a different Upwork surface, navigate to the Talent / Freelancer search and re-apply the filters.
2. SEARCH DELAY: after loading the search URL for a keyword — and before reading any results — WAIT 20 seconds. Apply this 20-second delay for every keyword search, including each time you switch to a new keyword. Then wait for the results list to fully load before reading it. Scroll if results are lazy-loaded.
3. Build a list of profile result links on the current page. Capture each profile's CANONICAL URL — the /freelancers/~01xxxxxxxxxxxxxxxx form. Profile links often redirect to a vanity slug (e.g. /freelancers/somehandle); always record and dedupe on the ~01 id, not the vanity slug. Immediately drop any id that is in ALREADY_SAVED or already seen this run. Do NOT extract saved data from the search snippet — open each profile. (You MAY read the snippet only to pre-skip a result that obviously fails a filter, e.g. wrong rate/location.) IMPORTANT: if you are logged in, Upwork pins YOUR OWN profile (owner/edit view) to the top of every results page — skip it; it is not a search match.
4. For each remaining (non-duplicate) profile, until you have saved MAX_PROFILES new ones:
a. Re-check: if the id is in ALREADY_SAVED, skip it (do not open, do not count).
b. Open the profile (new tab or navigate, then return to results).
c. Wait until the profile page is fully rendered.
d. VERIFY the profile still qualifies: hourly_rate >= MIN_HOURLY_RATE, location within LOCATIONS, and (if TOP_RATED_PLUS=yes) the Top Rated Plus badge is present. If it does not qualify (filters occasionally leak), skip it — do not save it and do not count it toward MAX_PROFILES.
e. Extract every field listed in "Data to capture" below. If a field is missing on the page, write the literal value `null` — never invent or infer it.
f. Save the profile as a markdown file (see "Output format"), then add its id to ALREADY_SAVED.
g. Return to the search results, then WAIT a random delay of 0.5–2 minutes (30–120 seconds, freshly randomized for each profile) before opening the next profile. Continue.
5. If the current page is exhausted and you still need more profiles, go to the next results page (append &page=N to the filtered URL) and repeat from step 2.

## Data to capture (per profile)
- url (the canonical ~01 profile URL)
- name (display name as shown; may be first name + last initial)
- title (the headline/professional title)
- hourly_rate
- location (city/country + local time if shown)
- availability (e.g. "More than 30 hrs/week", or null)
- job_success_score (e.g. "98% Job Success")
- total_earnings (a dollar figure if shown; the literal "Private" if the page shows "Private earnings"; null only if truly absent)
- total_jobs / total_hours
- overview (the full "About" / overview text, verbatim)
- skills (list of all skill tags)
- work_history (recent work history entries: title, rating, feedback text, dates)
- portfolio_items (titles + links if present)
- certifications
- employment_history
- education
- languages (capture each language with its proficiency in a readable form: "Language (Proficiency)", e.g. "English (Native or Bilingual)". Convert any "Language: Proficiency" shown on the page into this parenthesized form — never leave a raw colon, which breaks YAML.)
- badges (e.g. "Top Rated Plus", "Top Rated", "Rising Talent")

## Pagination (explicit)
Work history and portfolio render paginated ("page 1 of N"). By DEFAULT capture only the FIRST page of each (MAX_HISTORY_PAGES=1) for speed and predictable output, and record the total page count, e.g. "(work history: page 1 of 4 shown)". Only click through additional pages if MAX_HISTORY_PAGES > 1, and never paginate beyond MAX_HISTORY_PAGES.

## Output format
- One file per profile, written to OUTPUT_DIR.
- Filename: `<slugified-name>-<short-id>.md` (slug = lowercase, spaces→dashes; short-id = the ~01 id without the tilde). If name is null, use the short-id alone. Because the filename embeds the ~01 id, an existing file for the same profile is detectable before re-downloading.
- File contents: YAML frontmatter with all scalar fields, then markdown body for the long-form text. Template:

---
url: <url>
name: <name>
title: <title>
hourly_rate: <hourly_rate>
location: <location>
availability: <availability>
job_success_score: <job_success_score>
total_earnings: <total_earnings>
total_jobs: <total_jobs>
total_hours: <total_hours>
badges: [<badge>, ...]
languages: ["English (Native or Bilingual)", ...]   # quote each entry; use readable "Language (Proficiency)" format, never a raw "Language: Proficiency" colon
skills: [<skill>, ...]
scraped_at: <ISO timestamp>
input_keywords: "{{KEYWORDS}}"        # the full KEYWORDS input for this run
matched_keyword: <the exact keyword query (the q= value) that surfaced this profile; for a single-keyword run this equals input_keywords>
---

## Overview
<overview verbatim, or null>

## Work history
<each entry: title, rating, feedback, dates>

## Portfolio
<items + links, or null>

## Certifications / Education / Employment
<as available, or null>

## Rules (do not violate)
- PERSISTENT DEDUP: never re-download or overwrite a profile already present in OUTPUT_DIR. Dedupe by the canonical ~01 profile id / url across runs (build ALREADY_SAVED from OUTPUT_DIR before collecting). Duplicates do not count toward MAX_PROFILES and should not be re-opened.
- HARD FILTER: only save profiles with hourly_rate >= MIN_HOURLY_RATE, a location inside LOCATIONS, and the Top Rated Plus badge when TOP_RATED_PLUS=yes. Apply the filters in the search URL AND re-verify on each profile page.
- Skip your own logged-in profile (the owner/edit view pinned to the top of results).
- NEVER fabricate, summarize-away, or guess any value. Copy what's on the page; use `null` for anything absent. Verbatim text for overview and feedback.
- One profile = one file. The `-2`/`-3` filename-collision suffix is ONLY for two DIFFERENT profiles that slugify to the same name — never to make a second copy of a profile that already exists (those must be skipped).
- Do NOT collect SAVED data from search snippets, ads, or "similar profiles" sidebars — only from the opened profile page itself (snippets may be used only to pre-skip obvious non-matches).
- If a login wall, CAPTCHA, or "verify you are human" appears, STOP and tell me exactly what you hit and which profile you were on. Do not attempt to bypass it.
- Move at a human pace: after searching each profile, wait a RANDOM delay of 0.5–2 minutes (30–120 seconds, freshly randomized per profile) before opening the next one, to avoid rate-limiting.
- If a profile fails to load after a retry, record it in a `failed.md` log with the URL and the reason, then continue to the next one.

## Troubleshooting (browser/runtime issues seen in real runs — fix in this order)

### A) Cloudflare "Just a moment…" / "Challenge - Upwork" / "verify you are human"
- A brief Cloudflare interstitial often appears right after navigating to a search URL or profile. It usually clears ON ITS OWN within ~10–20s. So: after navigating, WAIT (the 20s search delay covers this), then read the page. If the title still says "Challenge"/"Just a moment", wait another ~10s and re-read once.
- Do NOT try to solve/click the challenge yourself and do NOT bypass it with curl/JS/etc. (Solving/clicking a "verify you are human" / CAPTCHA checkbox is not permitted for the assistant.)
- **Sustained block (challenge will NOT clear, repeats on every search/profile):** this is rate-limiting / a human-verification wall. Do NOT wait it out and do NOT keep hammering it with retries. Instead, **ASK THE USER to click the verification checkbox** in the Chrome window, and tell them exactly which profile/keyword you're paused on. Once the user confirms they've verified, re-navigate to the search URL and continue from that exact spot. Resume is always safe because saves are per-profile and dedup is per-folder.
- To reduce the chance of triggering this, keep the human-pace pacing (20s after each search, ~30–45s between profiles) and avoid bursts of rapid navigation.

### B) Profile page returns "No text content found" right after navigating
- The SPA hasn't painted yet. Wait ~5–6s and call get_page_text again. This normally succeeds on the 2nd try.

### C) A profile id REDIRECTS to an already-saved person (vanity/duplicate id)
- Some `~01…` ids resolve to the same freelancer (the page shows a different name/id than requested). If the loaded profile's ~01 id is already in this folder, treat it as a duplicate: skip it and take the next candidate from the search list.

### D) sandbox `sleep` returns "bash failed on resume … Command timed out"
- This is just the sandbox killing a long sleep; the delay still effectively happened. Ignore the error and continue. Keep individual sleeps ≤ ~44s (the bash tool caps at 45s) — for longer pacing, the timeout itself serves as the wait.

### E) ⭐ Browser FROZEN / navigation silently not changing the page (most disruptive)
Symptoms: `navigate` returns "Navigated to …" but `tabs_context_mcp`/page still shows the OLD url; the page is stuck on a previous profile or on `chrome://newtab/`; `javascript_tool` times out with "renderer may be frozen/unresponsive"; even a fresh tab won't load any URL.
Fix IN THIS ORDER, re-testing with a light `get_page_text` after each step:
  1. Wait ~20–25s and retry the navigate once (transient hangs sometimes clear).
  2. Open a NEW tab (`tabs_create_mcp`), get context, and navigate THERE. Close the frozen tab (`tabs_close_mcp`).
  3. If the new tab also won't navigate (still `chrome://newtab/` after a homepage test like `https://www.upwork.com/`), the whole Chrome renderer is hung — closing a tab is NOT enough.
  4. Call `switch_browser` (or `list_connected_browsers` → `select_browser`) to RE-ESTABLISH the extension connection / pick the recovered browser. This reconnects without needing the user.
  5. Only if `switch_browser` cannot recover it: ask the user to FULLY QUIT Chrome (Cmd+Q, not just close the window) and reopen upwork.com logged in, then resume.
- Resuming is always safe: every profile is written to disk immediately and dedup is per-folder, so re-run the current keyword and already-saved ids are skipped automatically.

### General resume rule
Because each `.md` is saved the moment it's extracted and dedup is rebuilt from the folder, you can stop/resume at any time. On resume: recount files per folder, determine the current keyword's remaining count, and continue — never re-open ids already in the folder.

## When done
Report: how many NEW profiles were saved, how many were skipped as already-existing duplicates, how many failed (with reasons), how many were skipped for not meeting the rate/location/badge filter, the OUTPUT_DIR path, and the list of saved filenames.
