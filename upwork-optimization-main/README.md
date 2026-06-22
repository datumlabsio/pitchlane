# Upwork Optimization

A toolkit for sharpening Upwork freelancer profiles. For each person it compares their tentative profile against a set of similar competitor profiles, surfaces where they overlap and where they're missing in-demand skills/tools, then turns those findings into a rewritten profile and a set of job-search keywords — all rendered as self-contained, interactive HTML.

## What it does

1. **Compare** a person's baseline profile against every competitor profile they've collected, computing six signals (baseline-only / collected-only / shared, for both **tools** and **skills**).
2. **Propose** an improved, Upwork-compliant profile (title, overview, skills, categories, rate) grounded in the gap analysis — never inventing experience.
3. **Generate** 30 Upwork saved-search keywords per person to find the right jobs.

Everything runs **independently per person** — no cross-person mixing.

## Repository layout

```
Upwork-Optimization/
├── README.md
├── analysis_data.json          # machine-readable comparison output (drives the artifacts)
├── prompts/                    # the reusable "recipes" (LLM prompts)
│   ├── upwork_profile_analysis_prompt.md       # baseline vs competitors → six signals
│   ├── upwork_profile_proposal_prompt.md       # → new title/overview/skills/categories + saved searches
│   ├── upwork_saved_search_keywords_prompt.md  # → 30 saved-search keywords per person
│   └── find-and-download-profiles-by-skill.md  # how the competitor profiles were collected
├── scripts/                    # Python that implements the analysis + builds the HTML
│   ├── analyze.py              # parse profiles, classify tools vs skills, compute six signals → analysis_data.json
│   ├── build_html.py           # → upwork_profile_comparison.html
│   ├── build_compare_all.py    # → profile_current_vs_proposed.html (all people)
│   ├── build_keywords.py       # → upwork_saved_search_keywords.html
│   ├── build_proposal_abdur.py # one-person copy-ready proposal (earlier single-person build)
│   └── build_compare_abdur.py  # one-person side-by-side (earlier single-person build)
├── artifacts/                  # generated, self-contained HTML (no external calls)
│   ├── upwork_profile_comparison.html       # one tab per person; six signals + roll-ups
│   ├── profile_current_vs_proposed.html     # Upwork-themed current vs proposed, per person
│   └── upwork_saved_search_keywords.html    # 30 copy-ready keywords per person
└── profiles/                   # one folder per person
    └── <PersonName>/
        ├── baseline.md         # the person's own profile (generated from the content doc)
        └── *.md                # collected competitor profiles to compare against
```

## Current data

Five people, each with a baseline + collected competitor profiles:

| Person | Collected profiles |
|---|---|
| Abdur Rehman | 90 |
| Hadiqa | 80 |
| Haris | 96 |
| Humayun | 95 |
| Nidal | 97 |

Baselines are sourced from the content doc (`Finalize Upwork Content.docx`): one section per person (name, title, overview, skills), parsed into each `profiles/<PersonName>/baseline.md`.

## How the pieces connect

```
baseline.md + competitor *.md  ──analyze.py──▶  analysis_data.json
                                                      │
                 ┌────────────────────────────────────┼────────────────────────────────────┐
        build_html.py                         build_compare_all.py                   build_keywords.py
                 │                                      │                                      │
   upwork_profile_comparison.html      profile_current_vs_proposed.html     upwork_saved_search_keywords.html
```

## Regenerating the artifacts

The scripts read `profiles/` and write outputs relative to their own location. Run `analyze.py` first (it produces `analysis_data.json`), then the builders:

```bash
python3 scripts/analyze.py
python3 scripts/build_html.py
python3 scripts/build_compare_all.py
python3 scripts/build_keywords.py
```

> Note: the build scripts currently resolve paths from their own folder, so adjust the working directory (or the `HERE`/output paths) if you move things around.

## Key conventions

- **Tools vs skills.** Tools are named technologies/products/frameworks/languages; skills are capabilities/services/methods. The classifier in `analyze.py` splits them so the six signals are computed per category.
- **Six signals (per competitor, per category).** `baseline_only`, `collected_only`, `shared`, plus counts and an overlap ratio (`shared / total distinct`). Roll-ups aggregate these across all of a person's competitors.
- **Upwork limits respected in proposals.** Title ≤ 70 chars, Overview ≤ 5,000 chars, Skills ≤ 15, Categories ≤ 10. Auto-generated soft-skill tags (e.g. "Clear Communicator") are never placed in skill slots.
- **Saved-search keyword syntax.** Single words unquoted (`LangChain`); multi-word phrases quoted (`"data pipeline"`); alternatives joined with `OR` (`"Power BI" OR Tableau`).
- **Honesty.** Proposals and keywords only use skills/tools the person can genuinely claim; everything else is flagged to verify, not silently added.
