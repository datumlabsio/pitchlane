#!/usr/bin/env python3
"""Rebuild the Faizan analysis HTML so it matches the existing reference artifact
(artifacts/upwork_profile_comparison.html) exactly in look & interaction.

Approach: reshape faizan_analysis_data.json into the reference's {people:[...],
skipped:[]} schema (one person = Faizan), then reuse the reference HTML's CSS+JS
template verbatim, swapping only the embedded `const DATA = {...}` line.

Tools and skills stay in separate buckets; each collected profile is compared in
isolation against the single baseline (no pooling, no mixing).
"""
import os, json, re

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "faizan_analysis_data.json")
REF = os.path.join(HERE, "..", "artifacts", "upwork_profile_comparison.html")
OUT = os.path.join(HERE, "..", "artifacts", "faizan_profile_analysis.html")

d = json.load(open(SRC))

# Reshape into the reference schema: one person.
person = {
    "person": d["baseline"]["name"] or "Faizan K.",
    "baseline": d["baseline"],          # name,title,hourly_rate,url,tools,skills,n_tools,n_skills
    "n_collected": d["n_collected"],
    "comparisons": d["comparisons"],    # each: name,title,hourly_rate,url,tools{6 signals},skills{6 signals}
    "rollup": d["rollup"],              # tools_shared/base_only/coll_only, skills_*  (most_common lists)
    "avg_tool_overlap": d["avg_tool_overlap"],
    "avg_skill_overlap": d["avg_skill_overlap"],
}
reshaped = {"people": [person], "skipped": [], "generated": "2026-06-20"}

payload = json.dumps(reshaped).replace("</", "<\\/")

ref = open(REF, encoding="utf-8").read()

# Replace the embedded data line. The reference has: const DATA = {....};
m = re.search(r"const DATA\s*=\s*", ref)
start = m.start()
# find end of that statement: the line ends at the first "\n" after the JSON (data is single-line)
nl = ref.find("\n", m.end())
new_ref = ref[:start] + "const DATA = " + payload + ";" + ref[nl:]

# Update the header subtitle line so it reflects this run (keep identical styling/structure).
new_ref = new_ref.replace(
    "Each person's tentative profile (baseline, refreshed live from Upwork) compared against every collected reference profile. Six signals per comparison: baseline-only / collected-only / shared, for tools and for skills. Generated 2026-06-16.",
    "Baseline (Faizan K., refreshed live from Upwork) compared against every collected reference profile. Six signals per comparison: baseline-only / collected-only / shared, kept separate for tools and for skills. Generated 2026-06-20."
)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(new_ref)
print("wrote", os.path.abspath(OUT), len(new_ref), "bytes")
print("people:", len(reshaped["people"]), "| collected:", person["n_collected"])
