#!/usr/bin/env python3
"""Faizan K. — Current vs Proposed Upwork profile artifact.
Matches artifacts/profile_current_vs_proposed.html format (same CSS/markup/JS),
one tab (Faizan only — no other people). Grounded in the gap rollup from
scripts/faizan_analysis_data.json. Honest: every proposed skill is in his baseline,
except one clearly-true searched gap (Data Analysis). Limits enforced.
"""
import os, html, json

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "artifacts", "faizan_profile_proposal.html")
e = html.escape

# ---- Current (baseline) ----
cur_title = "Analytics Engineer | dbt + Power BI | Snowflake, BigQuery Expert"
cur_skills = ["Tableau","Python","Data Visualization","Microsoft Power BI","Marketing Analytics",
    "Data Engineering","Data Analytics","Snowflake","BigQuery","Data Warehousing & ETL Software",
    "dbt","Data Modeling","ETL Pipeline","Apache Spark","Looker Studio","SQL","PostgreSQL",
    "Business Intelligence","Apache Airflow","Google Analytics 4"]
cur_overview = [
 "Your dashboards are slow, your data sources don't agree with each other, and leadership has stopped trusting the numbers, I rebuild the analytics layer underneath, using dbt on Snowflake or BigQuery, so your team makes decisions on data you can actually defend.",
 "With over 11,000 hours logged and 80+ projects delivered on Upwork, I've worked with growth-stage SaaS startups, fintechs, retail and eCommerce operators, real estate firms, and global research organizations to design dbt-based data models, build end-to-end ETL/ELT pipelines, and deliver BI systems that eliminate reporting delays.",
 "How I work across the analytics engineering stack:",
 "Data Modeling and Transformation — dbt models on Snowflake and BigQuery that turn raw, multi-source data into clean, analytics-ready datasets, with testing, documentation, and modular design.",
 "Data Engineering and Pipelines — ETL/ELT pipelines using SQL, Python, and Apache Airflow across AWS, GCP, and Azure.",
 "Business Intelligence and Dashboards — interactive dashboards in Power BI, Tableau, and Looker Studio for KPI tracking, executive reporting, and self-service analytics.",
 "Cloud and Warehouse Expertise — Snowflake, BigQuery, PostgreSQL, and Redshift, integrating GA4, HubSpot, Salesforce, and Stripe into unified warehouses.",
]

# ---- Proposed ----
prop_title = "Analytics Engineer | dbt, Snowflake, BigQuery | Power BI & Looker"
prop_skills = ["dbt","Snowflake","BigQuery","Microsoft Power BI","Tableau","Looker Studio","SQL",
    "Python","PostgreSQL","Apache Airflow","Data Engineering","Data Modeling","Business Intelligence",
    "Data Visualization","Data Analysis"]
NEW = {"Data Analysis"}
dropped = ["Apache Spark","Google Analytics 4","Marketing Analytics","Data Analytics",
           "ETL Pipeline","Data Warehousing & ETL Software"]
prop_categories = ["Data Science & Analytics","Data Visualization","Data Engineering","ETL & Data Integration"]

prop_overview = [
 "I'm an analytics engineer who rebuilds the layer under your dashboards — dbt models on Snowflake or BigQuery, clean ETL/ELT pipelines, and Power BI, Tableau & Looker dashboards your team can finally trust and defend.",
 "Top Rated Plus with 100% Job Success, 11,000+ hours, and 80+ projects on Upwork. I've built analytics for SaaS startups, fintechs, retail &amp; eCommerce, real estate, and global research orgs — turning scattered, untrusted data into clean, governed, decision-ready reporting.",
 "What I build for you:\n• dbt data models on Snowflake &amp; BigQuery — tested, documented, modular\n• End-to-end ETL/ELT pipelines in SQL, Python &amp; Apache Airflow across AWS, GCP, Azure\n• BI dashboards in Power BI, Tableau &amp; Looker Studio — KPI tracking, executive &amp; self-service reporting\n• Warehouse builds &amp; migrations (Snowflake, BigQuery, PostgreSQL, Redshift) with GA4, HubSpot, Salesforce &amp; Stripe integrated into one model",
 "Recent work: a centralized analytics platform on Microsoft Fabric + Power BI for CGIAR; a real-time intelligence layer for Sojo Industries; a fintech migration off Metabase/Oracle BI/Vertica for Markets4U.",
 "End-to-end ownership from ingestion through dbt modeling to dashboard delivery — explained in business outcomes, not jargon. Tell me your data sources and goals and I'll map the cleanest path to reporting you can rely on.",
]

flagged = ["Data Analysis (added)","Dashboard","ETL","API Integration","Amazon Web Services",
           "Microsoft Azure","Microsoft Power BI Development"]

def char_count(s): return len(s)

def overview_html(paras):
    out=[]
    for p in paras:
        out.append("<p>"+e(p).replace("\n","<br>")+"</p>")
    return "".join(out)

def skills_html(skills, current=False):
    out=[]
    for s in skills:
        cls="pill"
        extra=""
        if current and s in dropped:
            cls="pill drop"
        if (not current) and s in NEW:
            cls="pill new"; extra='<span class="dot">＋ new</span>'
        out.append(f'<span class="{cls}">{e(s)}{extra}</span>')
    return "".join(out)

cur_ov = "".join(f"<p>{e(p)}</p>" for p in cur_overview)
prop_ov = overview_html(prop_overview)
ov_chars = sum(len(p) for p in prop_overview) + (len(prop_overview)-1)*2
hook_chars = len(prop_overview[0])

cats_html = "".join(f'<span class="pill cat">{e(c)}</span>' for c in prop_categories)

# copy-ready blocks (deliverable B)
prop_overview_plain = "\n\n".join(p.replace("&amp;","&") for p in prop_overview)
copy_skills_line = ", ".join(prop_skills)
copy_cats_line = ", ".join(prop_categories)

DOC = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Current vs Proposed — Faizan K. (Upwork)</title>
<style>
:root{{--green:#14a800;--green-d:#3c8000;--ink:#001e00;--mut:#5e6d55;--line:#d5e0d5;--bg:#f7faf7;--card:#fff;--new:#14a800;--drop:#b9b9b9;--soft:#d98c00;}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55}}
.top{{background:var(--card);border-bottom:1px solid var(--line);padding:16px 22px}}
.top h1{{margin:0;font-size:18px}}.top p{{margin:3px 0 0;color:var(--mut);font-size:13px}}
.tabs{{display:flex;gap:6px;flex-wrap:wrap;max-width:1180px;margin:0 auto;padding:14px 18px 0}}
.tab{{background:var(--card);border:1px solid var(--line);border-bottom:none;border-radius:9px 9px 0 0;padding:9px 15px;font-weight:600;color:var(--mut);cursor:pointer;font-size:13px}}
.tab.active{{color:var(--ink);border-color:var(--green);border-bottom:2px solid var(--card);margin-bottom:-1px}}
.wrap{{max-width:1180px;margin:0 auto;padding:14px 18px 70px}}
.panel{{display:none}}.panel.active{{display:block}}
.changes{{background:#eaf5e6;border:1px solid #bfe6b0;color:#1f4d12;border-radius:9px;padding:10px 14px;font-size:13px;margin-bottom:10px}}
.legend{{display:flex;gap:18px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:9px 14px;margin-bottom:14px;font-size:12px;color:var(--mut)}}
.legend i.lg{{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:middle}}
.lg.new{{background:var(--new)}}.lg.drop{{background:var(--drop)}}
.cols{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}@media(max-width:880px){{.cols{{grid-template-columns:1fr}}}}
.collabel{{font-size:12px;font-weight:700;color:var(--mut);margin-bottom:7px;text-transform:uppercase;letter-spacing:.05em;display:flex;gap:8px;align-items:center}}
.rec{{background:var(--green);color:#fff;font-size:10px;padding:2px 8px;border-radius:10px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,40,0,.05)}}
.phead{{display:flex;gap:13px}}.avatar{{width:50px;height:50px;border-radius:50%;background:var(--green);color:#fff;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}}
.pname{{font-size:16px;font-weight:700}}.verified{{color:var(--green);font-size:12px}}.ploc{{color:var(--mut);font-size:12.5px}}
.badges{{margin-top:5px;display:flex;flex-wrap:wrap;gap:6px}}.badge{{font-size:11px;color:var(--green-d);background:#eaf5e6;border-radius:11px;padding:2px 9px;font-weight:600}}
.ratebar{{display:flex;justify-content:space-between;align-items:baseline;margin-top:14px}}
.rate{{font-size:21px;font-weight:800}}.rl{{font-size:12px;color:var(--mut);margin-left:2px}}.ratenote{{font-size:11.5px;color:var(--green-d);font-weight:600}}
hr{{border:none;border-top:1px solid var(--line);margin:14px 0}}
.sectlabel{{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-weight:700;margin:15px 0 7px;display:flex;gap:7px;align-items:center}}
.cnt,.sc{{font-weight:600;color:var(--green-d);text-transform:none;letter-spacing:0}}
.ptitle{{font-size:16px;font-weight:700;line-height:1.35}}.ptitle.chg{{border-left:3px solid var(--green);padding-left:10px}}
.overview{{font-size:13px;color:#2a3a2a}}.overview p{{margin:0 0 8px}}
.pills{{display:flex;flex-wrap:wrap;gap:7px}}
.pill{{background:#f2f5f2;border:1px solid #e2ebe2;color:#3c4d3c;border-radius:16px;padding:4px 11px;font-size:12.5px}}
.pill.new{{background:#eaf7e6;border-color:#bfe6b0;color:var(--green-d);font-weight:600}}.pill.new .dot{{font-size:10px;color:var(--green);margin-left:5px}}
.pill.soft{{background:#fff4e3;border-color:#f0d5a6;color:#9a6700}}.pill.soft .softtag{{font-size:9px;margin-left:5px}}
.pill.drop{{opacity:.5;text-decoration:line-through}}
.pill.cat{{background:#eef3fb;border-color:#cfe0f5;color:#2c5fa6}}
.catnote{{color:var(--mut);font-style:italic;font-size:12.5px}}
.copywrap{{max-width:1180px;margin:0 auto;padding:0 18px 60px}}
.copysec{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-top:14px}}
.copysec h3{{margin:0 0 4px;font-size:15px}}
.fblock{{position:relative;margin:10px 0}}
.fblock label{{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);font-weight:700}}
.fblock .v{{background:#f2f7f2;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-top:5px;font-size:13px;white-space:pre-wrap;color:#173b17}}
.cp{{position:absolute;top:0;right:0;background:#eef3ee;border:1px solid var(--line);color:var(--green-d);border-radius:6px;padding:4px 10px;font-weight:600;cursor:pointer;font-size:12px}}
.cp:hover{{background:#e3efe1}}.cp.ok{{background:var(--green);color:#fff;border-color:var(--green)}}
.mini{{color:var(--mut);font-size:12px;margin-top:3px}}
table.rat{{border-collapse:collapse;width:100%;margin-top:8px;font-size:12.5px}}
table.rat th,table.rat td{{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}}
table.rat th{{background:#eaf5e6;color:#1f4d12}}
.flag{{background:#fff4e3;border:1px solid #f0d5a6;color:#9a6700;border-radius:8px;padding:9px 12px;font-size:12.5px;margin-top:8px}}
</style></head><body>
<div class="top"><h1>Current vs Proposed — Upwork profile preview</h1>
<p>Rendered to mirror an Upwork profile. Left = current (live profile). Right = recommended rewrite, grounded in the 100-profile competitor gap analysis. Limits enforced: Title ≤70, Skills ≤15, Categories ≤10. Single person — Faizan K. only.</p></div>
<div class="tabs"><button class="tab active" onclick="show(0)">Faizan K.</button></div>
<div class="wrap"><div class="panel active" id="p-0">
  <div class="changes"><b>Key changes:</b> Trimmed Skills from 20 to the 15-slot limit, prioritizing the highest client-search demand from the gap analysis (Python 41, Data Visualization 34, SQL 29, Power BI 22) while protecting your low-competition differentiators (dbt, Snowflake, Apache Airflow). Added <b>Data Analysis</b> — the #1 skill competitors list that you don't (29/100). Tightened the overview hook to stand alone in search; raised rate toward senior analytics-engineer / EU peer levels.</div>
  <div class="legend">
    <span><i class="lg new"></i>New (1): Data Analysis</span>
    <span><i class="lg drop"></i>Dropped (6): Apache Spark, Google Analytics 4, Marketing Analytics, Data Analytics, ETL Pipeline, Data Warehousing &amp; ETL Software</span></div>
  <div class="cols">
    <div class="col"><div class="collabel">Current</div>
      <div class="card">
        <div class="phead"><div class="avatar">FK</div>
          <div><div class="pname">Faizan K. <span class="verified">✓</span></div>
          <div class="ploc">Berlin, Germany</div>
          <div class="badges"><span class="badge">Top Rated Plus</span><span class="badge">100% Job Success</span></div></div></div>
        <div class="ratebar"><div><span class="rate">$60.00/hr</span><span class="rl">/hr</span></div></div><hr>
        <div class="sectlabel">Title <span class="cnt">{char_count(cur_title)}/70</span></div><div class="ptitle">{e(cur_title)}</div>
        <div class="sectlabel">Overview</div><div class="overview">{cur_ov}</div>
        <div class="sectlabel">Skills <span class="sc">{len(cur_skills)} / 15</span></div><div class="pills">{skills_html(cur_skills, current=True)}</div>
        <div class="sectlabel">Categories <span class="sc"></span></div><div class="pills"><span class="catnote">not optimized</span></div>
      </div></div>
    <div class="col"><div class="collabel">Proposed<span class="rec">recommended</span></div>
      <div class="card">
        <div class="phead"><div class="avatar">FK</div>
          <div><div class="pname">Faizan K. <span class="verified">✓</span></div>
          <div class="ploc">Berlin, Germany</div>
          <div class="badges"><span class="badge">Top Rated Plus</span><span class="badge">100% Job Success</span></div></div></div>
        <div class="ratebar"><div><span class="rate">$85.00/hr</span><span class="rl">/hr</span></div><div class="ratenote">suggested $75–$95 (from $60)</div></div><hr>
        <div class="sectlabel">Title <span class="cnt">{char_count(prop_title)}/70</span></div><div class="ptitle chg">{e(prop_title)}</div>
        <div class="sectlabel">Overview <span class="cnt">{ov_chars}/5000 · hook {hook_chars}</span></div><div class="overview">{prop_ov}</div>
        <div class="sectlabel">Skills <span class="sc">{len(prop_skills)} / 15</span></div><div class="pills">{skills_html(prop_skills)}</div>
        <div class="sectlabel">Categories <span class="sc">up to 10</span></div><div class="pills">{cats_html}</div>
      </div></div>
  </div>

  <div class="copywrap" style="padding-left:0;padding-right:0">
   <div class="copysec">
     <h3>Copy-ready fields</h3>
     <div class="mini">Target positioning: senior analytics engineer for SaaS/fintech/eCommerce teams who need a trusted dbt + warehouse + BI layer (not just a dashboard). Paste each block straight into Upwork.</div>
     <div class="fblock"><label>Title ({char_count(prop_title)}/70)</label><button class="cp" onclick="cp(this,'t')">Copy</button><div class="v" id="f-t">{e(prop_title)}</div></div>
     <div class="fblock"><label>Overview ({ov_chars}/5000 — hook = first {hook_chars} chars)</label><button class="cp" onclick="cp(this,'o')">Copy</button><div class="v" id="f-o">{e(prop_overview_plain)}</div></div>
     <div class="fblock"><label>Skills (15) — comma line</label><button class="cp" onclick="cp(this,'s')">Copy</button><div class="v" id="f-s">{e(copy_skills_line)}</div></div>
     <div class="fblock"><label>Categories — comma line</label><button class="cp" onclick="cp(this,'c')">Copy</button><div class="v" id="f-c">{e(copy_cats_line)}</div></div>
     <div class="flag"><b>Consider adding / rotate in (verify first):</b> {e(", ".join(flagged[1:]))}. These are real gaps you can credibly serve (Dashboard 9, API Integration 14, AWS 9, Azure 6 in the gap analysis) — swap them in over time. <b>Not recommended</b> (off your positioning): Machine Learning, Data Science, Artificial Intelligence, AI Agent Development, Node.js, React, Full-Stack Development.</div>
   </div>
   <div class="copysec">
     <h3>What changed &amp; why</h3>
     <table class="rat">
       <tr><th>Change</th><th>Signal from the 100-profile analysis</th></tr>
       <tr><td>Added <b>Data Analysis</b> to Skills</td><td>Top collected-only skill — 29/100 competitors list it; you don't. Honest for an analytics engineer.</td></tr>
       <tr><td>Kept dbt, Snowflake, Apache Airflow despite low shared counts</td><td>base-only differentiators (dbt 97, Snowflake 98, Airflow 95 of 100) — low competition, high value; lead with them.</td></tr>
       <tr><td>Kept Python, SQL, Power BI, Tableau, Looker Studio, Data Visualization</td><td>Highest shared/in-demand terms (Python 41, Data Visualization 34, SQL 29, Power BI 22) — table stakes.</td></tr>
       <tr><td>Dropped Apache Spark, Data Warehousing &amp; ETL Software, Data Analytics, ETL Pipeline, Marketing Analytics, GA4</td><td>15-slot cap: lowest search leverage / redundant (Spark shared 2, DW&amp;ETL shared 3, Data Analytics ≈ Data Analysis). ETL still carried in title + overview; GA4 kept as a flagged rotate-in.</td></tr>
       <tr><td>Rate $60 → $85 (suggest $75–$95)</td><td>Top Rated Plus, 11K hrs, EU-based, senior niche; data/BI peers in the set commonly bill $75–$200+ (several Expert-Vetted $100–$250).</td></tr>
       <tr><td>Tightened overview hook</td><td>First ~250 chars must stand alone in search previews; now leads with who you help + the outcome.</td></tr>
     </table>
     <div class="mini">No soft-skill tags placed in skill slots (those are review-generated). No contact info / off-platform / unverifiable claims. Every proposed skill is in your live profile except Data Analysis (clearly true, flagged as the one add).</div>
   </div>
  </div>

</div></div>
<script>
function show(i){{document.querySelectorAll('.panel').forEach((p,j)=>p.classList.toggle('active',j===i));
document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('active',j===i));}}
function cp(btn,id){{const el=document.getElementById('f-'+id);navigator.clipboard.writeText(el.textContent).then(()=>{{const o=btn.textContent;btn.textContent='Copied';btn.classList.add('ok');setTimeout(()=>{{btn.textContent=o;btn.classList.remove('ok');}},1100);}});}}
</script></body></html>"""

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(DOC)
print("wrote", os.path.abspath(OUT), len(DOC), "bytes")
print("title chars:", char_count(prop_title), "| overview chars:", ov_chars, "| hook:", hook_chars,
      "| skills:", len(prop_skills), "| cats:", len(prop_categories))
