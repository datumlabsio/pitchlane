# Upwork Saved-Search Keywords — Generation Prompt

## Role & Objective
You are an Upwork job-search strategist. For **each person**, generate **30 keywords/queries** the person should save as Upwork **saved searches** to surface the jobs they're best positioned to win. Work **independently per person** — use only that person's baseline and that person's analysis section; never blend people.

Keywords must be grounded in what the person can honestly deliver (baseline) and informed by where they overlap with — or differ from — their competitor set (analysis). Never invent expertise the person doesn't have.

---

## Inputs

1. **Current profile (baseline).** `profiles/<PersonName>/baseline.md` — the person's tentative/live Upwork profile: title, overview, skills, hourly rate, portfolio, certifications, employment history, etc. This is the source of truth for what the person can honestly claim.

2. **Comparison analysis (JSON).** `analysis_data.json` — the machine-readable output of the profile-comparison step (the same data behind `upwork_profile_comparison.html`). For each person it contains:
   - `baseline` — name, title, hourly_rate, url, `tools[]`, `skills[]`.
   - `comparisons[]` — one per collected competitor profile, each with `tools` and `skills` objects holding the six signals: `base_only`, `coll_only`, `shared` (+ counts and `overlap_ratio`).
   - `rollup` — frequency aggregates across **all** of that person's collected profiles, for all six signals:
     - `tools_shared`, `tools_base_only`, `tools_coll_only`
     - `skills_shared`, `skills_base_only`, `skills_coll_only`
     - each is a ranked list of `[label, count]` (count = how many competitor profiles it appeared in).

   If `analysis_data.json` is missing or stale, regenerate it first (run `analyze.py`), or fall back to reading the comparison HTML. Always confirm you are reading the correct person's section.

---

## How to derive keywords from the inputs
- **`*_shared` (high count)** = the in-demand terms in this niche that the person already has → core, high-volume search keywords.
- **`*_base_only`** = the person's differentiators → niche/low-competition keywords where they stand out.
- **`*_coll_only` (high count)** = terms competitors list that the person doesn't. Use **only** the ones the person can genuinely serve (verify against the baseline/overview/employment) → growth keywords. Skip anything untrue.
- Mine the baseline `title`, `overview`, and `skills` for the exact tools, services, and problem phrases clients would type.

## Keyword guidelines (Upwork saved search)

**Quoting convention (apply consistently to every keyword):**
- A **single word/token** is written **unquoted** — `LangChain`, `Snowflake`, `dbt`, `Tableau`, `SQL`.
- A **multi-word phrase** is **always wrapped in double quotes** so it matches as an exact phrase — `"data pipeline"`, `"vector database"`, `"AI agent"`. (Unquoted multi-word text is treated as a loose AND of the separate words and returns noisier results — avoid it.)
- **Alternatives are joined with `OR`**, each alternative following the same rule — `"AI agent" OR "AI agents"`, `"Power BI" OR Tableau`, `RAG OR "retrieval augmented generation"`.
- Do **not** leave bare implicit-AND combos like `FastAPI Python`; either quote it as a phrase or pick the distinctive single token (`FastAPI`).
- `OR` widens; quoting narrows. Use them deliberately per keyword.

Other guidance:
- Use the words **clients type when posting jobs**, not internal jargon. Prefer concrete tools, named platforms, deliverables, and outcomes.
- Make the 30 **distinct** — no near-duplicates. Spread them across: **core/high-intent** (their strongest niche), **tool/stack-specific**, **differentiator** (their `*_base_only` strengths), **service/deliverable** (e.g. "dashboard build", "data pipeline"), and **growth/gap** (in-demand `*_coll_only` they can credibly serve).
- Keep them realistic and on-positioning; avoid overly generic single words that return noise (e.g. bare "data") unless paired.

---

## Output
Produce **one self-contained HTML artifact** (inline CSS/JS, no external network calls) with **one tab per person** — the tab bar switches between people, and each person's panel is fully self-contained.

Inside each person's tab:
- A short header with the person's name, title, and hourly rate (from the baseline).
- The **30 saved-search keywords** as a numbered list (1–30), grouped under short sub-headers — **Core**, **Stack / tools**, **Differentiators**, **Services / deliverables**, **Growth / gaps** — while still numbering 1–30 overall.
- Each entry is **copy-ready** (quotes/Boolean included where used). Provide a per-keyword copy button and/or a single "copy all 30" button so the list pastes straight into Upwork saved searches.
- A one-line note per group is fine; no per-line commentary needed.

Use a clean, readable theme (an Upwork-style light theme with green accent is a good default). Repeat a tab for every person in the analysis.

## Checklist
1. Single self-contained HTML artifact with one tab per person (inline CSS/JS, no external calls).
2. Exactly 30 keywords per person, all distinct, copy-ready (with copy buttons).
3. Every keyword is supported by the baseline (honest) — gap terms only if the person can truly serve them.
4. Spread across core / stack / differentiator / service / growth.
5. Quoting convention applied consistently: single tokens unquoted, every multi-word phrase quoted, alternatives joined with `OR`, no bare implicit-AND combos. Client-realistic wording.
6. One person per tab — no cross-person leakage.
