# Upwork Profile Comparison — Analysis Prompt

## Role & Objective
You are a data analyst. I will give you a set of Upwork profiles organized **per person**. For each person there are two kinds of profiles:

- **Their profile** — one tentative profile that this person is about to publish on Upwork (the baseline).
- **Collected profiles** — other Upwork profiles, similar to this person's target job, that they have downloaded and saved for reference.

Your job is, **for each person**, to compare **their profile** against **each of their collected profiles** and surface six "signals" for every collected profile, then present everything in a single interactive HTML artifact with **one tab per person**.

The analysis MUST be performed **independently per person**. Each person has their own tentative profile and their own set of collected profiles. Compare a person's profile only against that same person's collected profiles. Never pool profiles across people, never reuse one person's results for another, and never compare across folders. Treat each person's folder as a fully isolated unit of analysis.

---

## Step 1 (do this first) — Load baselines from the baseline `.docx`

The baseline (tentative) profile for **every** person comes from a single **Word document (`.docx`)** I provide — e.g. `Finalize Upwork Content.docx`. This is the source of truth for baselines. Do **not** fetch from live Upwork and do **not** rely on a possibly-stale `baseline.md`; build each `baseline.md` from the docx.

**Docx structure (one section per person, stacked top to bottom):**
- The **person's name** is a paragraph styled `Title` (one per person). A new `Title` paragraph marks the start of the next person's section.
- The **profile title/headline** is the `Heading 3` paragraph immediately under the name (it may be prefixed with `Title :` — strip that prefix).
- The **overview/description** is the run of body (`normal`) paragraphs that follow, up to the skills label. Preserve the text (you may normalize decorative unicode bold/emoji headers to plain text).
- The **skills** follow a label paragraph containing `Skills Keyword` / `Skills Keywords:` — each subsequent `- skill` bullet line is one skill tag (tolerate stray spaces/missing spaces like `-LLM`).

**For each person:**
1. Parse the docx into per-person sections by splitting on the `Title`-styled paragraphs.
2. Match each docx section to a person **folder** by name (case-insensitive; the folder name is the canonical Person Name — e.g. docx section `<PersonName>` → folder `<PersonName>`). Report any docx section with no matching folder, and any folder with no docx section.
3. Extract that person's **title, overview, and skills** and write them into the person's `baseline.md`, **creating it if missing or replacing it if present**. This becomes the baseline used for analysis.
4. If a person folder has **no** section in the docx, report it and skip that person (do not invent a baseline, do not fall back to live Upwork).

Only after baselines are built from the docx should you proceed to structure verification and the comparison.

---

## Inputs

`BASELINE_DOCX_PATH`: _<path to the Word doc that holds every person's baseline profile (title, overview, skills), one section per person — see Step 1>_

`ROOT_FOLDER_PATH`: _<path to the root folder that contains one subfolder per person>_

Expected structure inside the root folder (note: `baseline.md` is **generated from the docx** in Step 1, not supplied by hand):

```
ROOT_FOLDER_PATH/
  <PersonName>/
    baseline.md                  <- this person's own tentative profile (the baseline)
    abdul-a-01faa157...md        <- a collected similar profile
    adrian-d-01e69bfa...md       <- a collected similar profile
    ...                          <- every other .md is a collected profile
  <AnotherPersonName>/
    baseline.md
    martin-g-01b1226c...md
    ...
```

- Each `.md` file is one full Upwork profile and contains fields such as: profile title, description, skills, skill categories, hourly rate, and other details.
- Within each person's folder, the **tentative/baseline profile** is the `baseline.md` you generate from that person's docx section in Step 1. **Every other `.md` file in the same folder is a collected/reference profile** to compare against. There is no subfolder — collected profiles sit directly alongside `baseline.md`.
- If a person has no section in the baseline docx, treat that as "baseline not yet added" — report it and skip that person (do not pick a collected file as the baseline, do not fetch from live Upwork).

### Step 2 — Verify the structure
After building baselines from the docx, before the comparison:
1. List the root folder and confirm it contains one subfolder per person.
2. For each person folder, identify (a) the single baseline/tentative profile, which is the `baseline.md` you generated from the docx in Step 1, and (b) the set of collected profiles, which is **every other `.md` file in that same folder**.
3. Report what you found: number of people, whether each person has a docx section (and therefore a `baseline.md`), and the number of collected profiles per person.
4. If a person has no docx section (no baseline), report it and skip that person. Flag any empty folders or non-markdown files, and any docx section that has no matching folder. Do not guess which file is the baseline.

---

## Definitions

**Tools** = concrete named technologies, software, platforms, frameworks, languages, and products a person uses (e.g. Figma, React, Python, Photoshop, AWS, Shopify, Excel, HubSpot). When in doubt, "tools" are nouns you could install, license, or log into.

**Skills** = capabilities, services, disciplines, and methods (e.g. UI design, copywriting, SEO, data analysis, project management, brand strategy). When in doubt, "skills" are things a person *does*, not things they *use*.

**Extraction rules (apply identically to the baseline profile and every collected profile):**
- Pull tools and skills from the whole profile: title, description, skills list, and skill categories.
- Normalize for comparison: lowercase, trim whitespace, collapse obvious variants (e.g. "JS" ↔ "JavaScript", "PS" ↔ "Photoshop", "Node" ↔ "Node.js"). Keep a clean display label for output.
- Deduplicate within a single profile before comparing.
- If a term is genuinely ambiguous between tool and skill, place it in the more specific category (tool) and note it.

---

## The Six Signals

For each person, extract their baseline profile's tools/skills once. Then, **for each collected profile of that person**, compare the baseline ("theirs", i.e. the person's own) against the collected profile and compute:

**Tools**
1. **Baseline only** — tools in the person's profile but **not** in the collected profile (set difference).
2. **Collected only** — tools in the collected profile but **not** in the person's profile (set difference).
3. **Shared** — tools present in **both** profiles (intersection).

**Skills**
4. **Baseline only** — skill mentions in the person's profile but **not** in the collected profile.
5. **Collected only** — skill mentions in the collected profile but **not** in the person's profile.
6. **Shared** — skill mentions present in **both** profiles (intersection).

> Note on wording: "shared" / "in both" means the **intersection** (what the two profiles have in common), not the union. If you also want union counts (everything across both), include them as a supplementary metric, but the primary signal is the intersection.

For each signal, output both the **list of items** and the **count**. Also compute a per-comparison overlap summary (how many tools/skills are shared vs unique on each side, and a simple overlap ratio = shared / total distinct).

---

## Output — single HTML artifact

Produce one self-contained HTML artifact with:

- **One tab per person.** Inside a person's tab, show a clear section for each collected profile compared against that person's baseline (a person typically has several collected profiles). Keep each person's analysis fully self-contained.
- For each comparison, show **each of the six signals individually**, and every signal must have **both its count and its own visualization** (not just an aggregate overlap bar). The six signals are: Tools — baseline-only, collected-only, shared; Skills — baseline-only, collected-only, shared. Concretely:
  - A summary header (collected profile's title, hourly rate, profile id) alongside the person's baseline.
  - **Six labeled metric cards** — one per signal — each showing the metric's count prominently and a per-metric bar (e.g. the count scaled against the largest of the three signals in its category). Tools and Skills should be grouped so all six read clearly.
  - In addition, a combined visualization of tool overlap and skill overlap — e.g. a grouped/stacked bar (baseline-only / collected-only / shared) or Venn-style diagram per category, plus an overlap ratio (shared / total distinct).
  - The actual item lists for each of the six signals (the words themselves), grouped and labeled.
- A short plain-language interpretation per comparison (e.g. "high skill overlap, low tool overlap — this competitor leans on the same services but a different toolset").
- Optionally, a per-person roll-up: which tools/skills appear most often across the collected set but are missing from the person's profile (useful gaps to consider adding).
- Clean, readable styling. No external network calls; inline all CSS/JS. If using a chart library, use a CDN-friendly approach or hand-draw simple SVG/bar charts.

---

## Process checklist
1. Load baselines from the baseline `.docx` (Step 1): parse per-person sections (title, overview, skills) and create/replace each person's `baseline.md`.
2. Verify folder structure (Step 2); report counts and the baseline per person; stop on mismatch.
3. For each person: extract and normalize their baseline profile's tools + skills once.
4. For each collected profile of that person: extract, normalize, and compute the six signals **in isolation** against that person's baseline.
5. Build the HTML artifact with one tab per person and per-collected-profile breakdowns.
6. Before finishing, sanity-check: no cross-person leakage, every collected profile has all six signals, counts match the listed items.
