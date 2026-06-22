#!/usr/bin/env python3
"""Faizan K. — 30 Upwork saved-search keywords artifact.
Matches artifacts/upwork_saved_search_keywords.html format (same CSS/markup/JS),
one tab (Faizan only). Grounded in his baseline + the 100-profile gap analysis.
Quoting convention: single tokens unquoted; multi-word phrases quoted; OR for alternatives.
"""
import os, html
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "artifacts", "faizan_saved_search_keywords.html")
e = html.escape

GROUPS = [
 ("Core", [
   '"analytics engineer" OR "analytics engineering"',
   'dbt',
   '"data warehouse" OR "data warehousing"',
   '"modern data stack"',
   'BI OR "business intelligence"',
   '"data pipeline" OR "data pipelines"',
 ]),
 ("Stack / tools", [
   'Snowflake',
   'BigQuery',
   '"Power BI"',
   'Tableau',
   '"Looker Studio" OR "Google Data Studio"',
   'SQL',
   'Python OR Pandas',
   '"Apache Airflow" OR Airflow',
   'PostgreSQL OR Postgres',
   '"Apache Spark" OR PySpark',
 ]),
 ("Differentiators", [
   '"dbt modeling" OR "dbt models"',
   '"ELT pipeline" OR "ETL pipeline"',
   '"data modeling"',
   '"Snowflake dbt" OR "BigQuery dbt"',
 ]),
 ("Services / deliverables", [
   '"dashboard development" OR "dashboard build"',
   '"KPI dashboard" OR "executive dashboard"',
   '"data visualization"',
   '"automated reporting" OR "reporting automation"',
   '"data analysis" OR "data analytics"',
 ]),
 ("Growth / gaps", [
   'GA4 OR "Google Analytics 4"',
   '"Microsoft Fabric"',
   '"warehouse migration" OR "data migration"',
   'Redshift OR "Amazon Redshift"',
   '"marketing analytics" OR "revenue analytics"',
 ]),
]

# sanity: exactly 30, distinct
allkw = [k for _, ks in GROUPS for k in ks]
assert len(allkw) == 30, f"expected 30, got {len(allkw)}"
assert len(set(allkw)) == 30, "duplicates present"

NAME = "Faizan K."
TITLE = "Analytics Engineer | dbt + Power BI | Snowflake, BigQuery Expert"
RATE = "$60.00/hr"

# textarea (plain newline-joined, escaped)
all_text = e("\n".join(allkw))

# rows
n = 0
groups_html = []
for gname, ks in GROUPS:
    rows = []
    for kw in ks:
        n += 1
        kid = f"k0_{n}"
        rows.append(
            f'<div class="kw"><span class="num">{n}</span>'
            f'<code id="{kid}">{e(kw)}</code>'
            f'<button class="cp" onclick="cp(\'{kid}\',this)">Copy</button></div>'
        )
    groups_html.append(f'<div class="grp"><div class="gname">{e(gname)}</div>{"".join(rows)}</div>')
panel_inner = "".join(groups_html)

DOC = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Upwork Saved-Search Keywords — Faizan K.</title>
<style>
:root{{--green:#14a800;--green-d:#3c8000;--ink:#001e00;--mut:#5e6d55;--line:#d5e0d5;--bg:#f7faf7;--card:#fff;}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5}}
.top{{background:var(--card);border-bottom:1px solid var(--line);padding:16px 22px}}
.top h1{{margin:0;font-size:18px}}.top p{{margin:3px 0 0;color:var(--mut);font-size:13px}}
.conv{{max-width:1000px;margin:10px auto 0;padding:0 18px;color:var(--mut);font-size:12.5px}}
.conv code{{background:#eef3ee;border-radius:4px;padding:1px 5px;color:#173b17}}
.tabs{{display:flex;gap:6px;flex-wrap:wrap;max-width:1000px;margin:10px auto 0;padding:0 18px}}
.tab{{background:var(--card);border:1px solid var(--line);border-bottom:none;border-radius:9px 9px 0 0;padding:9px 15px;font-weight:600;color:var(--mut);cursor:pointer;font-size:13px}}
.tab.active{{color:var(--ink);border-color:var(--green);border-bottom:2px solid var(--card);margin-bottom:-1px}}
.wrap{{max-width:1000px;margin:0 auto;padding:16px 18px 70px}}
.panel{{display:none}}.panel.active{{display:block}}
.phead{{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:14px}}
.pname{{font-size:16px;font-weight:700}}.ptitle{{color:var(--mut);font-size:13px;margin-top:2px}}
.right{{text-align:right;white-space:nowrap}}.rate{{color:var(--green-d);font-weight:700;font-size:13px;display:block;margin-bottom:6px}}
.cpall{{background:var(--green);color:#fff;border:none;border-radius:7px;padding:7px 13px;font-weight:700;cursor:pointer;font-size:12px}}
.cpall:hover{{filter:brightness(1.08)}}.cpall.ok{{background:var(--green-d)}}
.grp{{margin-bottom:14px}}.gname{{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-weight:700;margin:6px 0 7px}}
.kw{{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:7px 10px;margin-bottom:6px}}
.num{{width:22px;text-align:right;color:var(--mut);font-size:12px;flex:0 0 auto}}
.kw code{{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:#173b17;background:#f2f7f2;border-radius:6px;padding:5px 9px;overflow-x:auto}}
.cp{{background:#eef3ee;border:1px solid var(--line);color:var(--green-d);border-radius:6px;padding:5px 11px;font-weight:600;cursor:pointer;font-size:12px;flex:0 0 auto}}
.cp:hover{{background:#e3efe1}}.cp.ok{{background:var(--green);color:#fff;border-color:var(--green)}}
.hidden{{position:absolute;left:-9999px;top:-9999px}}
</style></head><body>
<div class="top"><h1>Upwork Saved-Search Keywords — 30 for Faizan K.</h1>
<p>Grounded in the live baseline and the 100-profile competitor gap analysis. Grouped Core / Stack / Differentiators / Services / Growth. Single person only.</p></div>
<div class="conv">Quoting convention: single words are unquoted (<code>dbt</code>); multi-word phrases are quoted exactly (<code>"data pipeline"</code>); alternatives are joined with <code>OR</code> (<code>"Power BI" OR Tableau</code>). Click to copy a keyword, or "Copy all 30".</div>
<div class="tabs"><button class="tab active" onclick="show(0)">{e(NAME)}</button></div>
<div class="wrap"><div class="panel active" id="p0">
  <div class="phead"><div><div class="pname">{e(NAME)}</div><div class="ptitle">{e(TITLE)}</div></div>
  <div class="right"><span class="rate">{e(RATE)}</span>
  <button class="cpall" onclick="cpall(0,this)">Copy all 30</button></div></div>
  <textarea id="all0" class="hidden">{all_text}</textarea>
  {panel_inner}
</div></div>
<script>
function show(i){{document.querySelectorAll('.panel').forEach((p,j)=>p.classList.toggle('active',j===i));
document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('active',j===i));}}
function flash(b,t){{const o=b.textContent;b.textContent=t;b.classList.add('ok');setTimeout(()=>{{b.textContent=o;b.classList.remove('ok');}},1100);}}
function cp(id,b){{navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>flash(b,'Copied'));}}
function cpall(i,b){{navigator.clipboard.writeText(document.getElementById('all'+i).value).then(()=>flash(b,'Copied all'));}}
</script></body></html>"""

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(DOC)
print("wrote", os.path.abspath(OUT), len(DOC), "bytes | keywords:", len(allkw))
