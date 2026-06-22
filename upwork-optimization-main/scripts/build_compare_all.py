#!/usr/bin/env python3
import os, re, html, json
HERE=os.path.dirname(__file__); ROOT=os.path.join(HERE,"profiles")

ORDER=["Abdur Rehman","Hadiqa","Haris","Humayun","Nidal"]
META={  # display name, location, badges
 "Abdur Rehman":("Abdur R.","Peshawar, Pakistan",["Top Rated Plus","100% Job Success","Rising Talent"]),
 "Hadiqa":("Hadiqa M.","Karachi, Pakistan",["Top Rated Plus","100% Job Success"]),
 "Haris":("Haris","Pakistan",["Top Rated"]),
 "Humayun":("Muhammad Humayun J.","Lahore, Pakistan",["Top Rated Plus","100% Job Success"]),
 "Nidal":("Nidal","Pakistan",["Top Rated"]),
}

PROP={
 "Abdur Rehman":{
  "title":"AI Engineer | LLM, RAG & AI Agents | Python, FastAPI, LangChain",
  "rate":"$45.00/hr","ratenote":"suggested $40–$55 (from $25)",
  "skills":["AI Agent Development","Retrieval Augmented Generation","LangChain","Large Language Model","LLM Prompt Engineering","Generative AI","Artificial Intelligence","Machine Learning","Python","FastAPI","OpenAI API","API Integration","AI Chatbot","Vector Database","Next.js"],
  "cats":["AI & Machine Learning","Web, Mobile & Software Development","Data Science & Analytics"],
  "overview":"""I build production-grade AI agents, RAG systems, and LLM applications that solve real business problems — not demos. If you need an AI engineer who ships reliable, scalable systems in Python and FastAPI, wired into your own data, APIs, and tools, you're in the right place.

I'm a Top Rated Plus AI engineer with 100% Job Success and 11,000+ hours on Upwork. I combine strong backend engineering with modern agent tooling (Claude, OpenAI, LangChain, LlamaIndex, MCP) to build systems that reason, use tools, retrieve knowledge, and answer reliably at scale.

What I can build for you:
• AI agents and multi-agent systems with tool use and orchestration
• Retrieval-Augmented Generation (RAG) over your documents — semantic search, vector databases, memory
• AI chatbots and copilots grounded in your own data
• LLM-powered backends integrated with your APIs, CRMs, and SaaS tools
• AI automation pipelines (including n8n) and document intelligence (PDF, ETL, extraction)
• Scalable Python/FastAPI backends — plus full-stack delivery with Next.js, React, and Node.js

Anthropic-certified (Model Context Protocol, Building with the Claude API, Claude Code). Send me a short note about your project and goals — I'll tell you exactly how I'd approach it.""",
  "changes":"Added Large Language Model + Next.js; tightened the hook to stand alone in search; surfaced your full-stack stack (React/Node/TypeScript from Datum Labs) as rotate-in candidates; rate raised toward peer AI-engineer levels."},

 "Hadiqa":{
  "title":"BI & Analytics Engineer | Power BI, dbt, BigQuery & Snowflake",
  "rate":"$35.00/hr","ratenote":"suggested $30–$40 (from $20)",
  "skills":["Business Intelligence","Microsoft Power BI","Tableau","Looker Studio","BigQuery","Snowflake","dbt","SQL","Python","Data Visualization","Data Analytics","ETL","Dashboard Development","Data Modeling","AI Data Analytics"],
  "cats":["Data Science & Analytics","AI & Machine Learning"],
  "overview":"""I build modern data stacks and BI dashboards that teams actually trust — clean pipelines underneath, accurate numbers on top. If your reporting is manual, your dashboards disagree, or your data is scattered, I fix the foundation, not just the chart.

I'm a Top Rated Plus BI & Analytics Engineer with 4+ years building end-to-end analytics for SaaS companies, marketplaces, and startups: multi-source ingestion, data warehouses (BigQuery, Snowflake, ClickHouse), dbt modeling with tests and docs, and dashboards in Power BI, Tableau, Looker Studio, Hex, and Metabase.

What I deliver:
• End-to-end data stack: ingestion → warehouse → dbt transformation → BI
• ETL/ELT pipelines (dlt, Fivetran, Airbyte) and orchestration (Dagster)
• Trusted dashboards and reporting your team fully owns — no black boxes
• Revenue, product, and churn analytics, plus AI-derived signals

Stack: BigQuery, Snowflake, ClickHouse, dbt, SQL, Python, Power BI, Tableau, Looker Studio, Hex, Metabase. Every build is documented, tested, and handed over. Tell me your data sources and goals — I'll map the cleanest path to dashboards you can rely on.""",
  "changes":"Promoted the BI tools you actually use but hadn't listed (Power BI, Tableau, BigQuery, Snowflake) into Skills; added ETL, Dashboard Development, Data Modeling (top gaps); dropped weak/duplicate tags (Analytics, Visualization, Python Script, Zoho Analytics); rate raised off the floor."},

 "Haris":{
  "title":"Real-Time Data Engineer | Kafka, Snowflake, dbt, Airflow | ETL",
  "rate":"$45.00/hr","ratenote":"suggested $40–$55 (rate not set)",
  "skills":["Data Engineering","ETL Pipeline","Apache Kafka","Apache Airflow","dbt","Snowflake","BigQuery","ClickHouse","Python","SQL","Data Modeling","PostgreSQL","Amazon Web Services","Google Cloud Platform","Microsoft Power BI"],
  "cats":["Data Science & Analytics","Engineering & Architecture","IT & Networking"],
  "overview":"""I design real-time and batch data platforms that stay reliable under heavy load — streaming pipelines, clean models, and warehouses your team can trust for decisions. If you're scaling SaaS or fintech data, I build the foundation right.

I'm a Data Engineer specializing in real-time systems: Apache Kafka and CDC pipelines, event-driven architectures, dbt transformations, and warehouses on Snowflake, BigQuery, ClickHouse, and PostgreSQL — orchestrated with Airflow and Dagster on AWS and GCP.

What I deliver:
• Real-time and near-real-time pipelines (Kafka, CDC, streaming)
• ETL/ELT and dbt modeling with testing and documentation
• Cloud data warehouses and lakes, built for scale and concurrency
• Dashboards and reporting (Power BI, Superset, Metabase, Looker Studio, Tableau)
• Monitoring and alerting (Grafana, Prometheus) for observable pipelines

I build for real-time decision-making, reliability under volume, and long-term maintainability. Send your current setup and I'll map the best approach.""",
  "changes":"Trimmed from 20 to the 15-skill limit; added Apache Kafka (in your title but missing from skills), PostgreSQL, AWS, and Power BI (real + heavily searched gaps: Data Analysis 41, Power BI 34, Tableau 29); set a starting rate."},

 "Humayun":{
  "title":"Full-Stack & Data Engineer | SaaS, Analytics & AI | Next.js, Node",
  "rate":"$45.00/hr","ratenote":"holds at $45 (range $45–$60)",
  "skills":["Full Stack Development","SaaS Development","Next.js","React","Node.js","TypeScript","JavaScript","API Integration","RESTful API","PostgreSQL","Web Application Development","Database Development","Stripe","OpenAI API","AI Development"],
  "cats":["Web, Mobile & Software Development","AI & Machine Learning","Data Science & Analytics"],
  "overview":"""I build complete SaaS products and internal tools — frontend, backend, and AI features — that streamline operations and turn data into decisions. If you need someone to own the whole build, not just the UI, I take projects from planning to production.

I'm a Full-Stack & Data Engineer working with Next.js, React, TypeScript, Node.js, and PostgreSQL, plus analytics dashboards and AI-powered features (OpenAI API). I've built for SaaS, fintech, e-commerce, healthcare, and AI startups.

What I build:
• SaaS applications from idea to production
• Admin panels, client portals, and internal tools with role-based access
• Data dashboards, embedded analytics, and reporting systems
• AI-powered features and automation (OpenAI API, workflows)
• API integrations and secure, multi-tenant architecture (Stripe, RBAC)

Stack: Next.js, React, TypeScript, Node.js, PostgreSQL, Supabase, Tailwind, REST APIs. Clean, scalable, maintainable code with clear communication and fast delivery. Tell me what you're building — I'll help you design, build, and launch it.""",
  "changes":"Added JavaScript + TypeScript (top tool gaps, and in your stack); cleaned non-standard tags ('Business Intelligence (BI)' → standard names, 'AI Development'); trimmed from 19 to 15, dropping weaker tags (Authentication, Software Architecture, Analytics)."},

 "Nidal":{
  "title":"Data Engineer | ETL, Airflow, dbt, Snowflake | AWS · GCP · SQL",
  "rate":"$50.00/hr","ratenote":"suggested $45–$60 (rate not set)",
  "skills":["Data Engineering","ETL Pipeline","SQL","Python","dbt","Apache Airflow","Apache Kafka","Snowflake","BigQuery","Amazon Web Services","Google Cloud Platform","Docker","Kubernetes","Databricks Platform","PostgreSQL"],
  "cats":["Data Science & Analytics","IT & Networking","Engineering & Architecture"],
  "overview":"""I build and scale data pipelines that move reliably from source to warehouse — batch and streaming — so your analytics and ML always run on clean, fresh data. If your ETL is brittle or your stack needs to scale, I engineer it properly.

I'm a Data Engineer focused on ETL/ELT and real-time processing: Apache Airflow and dbt orchestration, Kafka streaming, and warehouses on Snowflake, BigQuery, Redshift, and ClickHouse — across AWS, GCP, and Azure, containerized with Docker and Kubernetes.

What I deliver:
• Scalable ETL/ELT pipelines (Airflow, dbt) and real-time streaming (Kafka)
• Cloud data warehouses and lakehouses (Snowflake, BigQuery, Redshift, Databricks)
• Infrastructure-as-code and containerized, observable deployments
• Clean, well-modeled SQL ready for BI and ML

Built for reliability, scale, and maintainability. Share your current data stack and goals — I'll map the most efficient path.""",
  "changes":"Added SQL (your single biggest gap — searched in 32 of 97 profiles, and missing from your tags); trimmed from 20 to 15, keeping your strongest cloud/orchestration stack; Terraform, DevOps, and Data Visualization noted as next rotate-ins."},
}

SOFT={"clear communicator","reliable","detail-oriented","solution-oriented","professional","collaborative","accountable for outcomes","committed to quality"}

def esc(s): return html.escape(s, quote=True)

def read_baseline(name):
    txt=open(os.path.join(ROOT,name,"baseline.md"),encoding="utf-8").read()
    fm=re.search(r'^---\s*\n(.*?)\n---', txt, re.S).group(1)
    def f(k):
        m=re.search(rf'^{k}:[ \t]*(.*)$', fm, re.M); return m.group(1).strip() if m else ""
    sk=re.search(r'skills:\s*\[(.*?)\]', fm, re.S)
    skills=[s.strip() for s in sk.group(1).split(',') if s.strip()] if sk else []
    ov=""
    if "## Overview" in txt:
        ov=txt.split("## Overview",1)[1].split("## Skills",1)[0].strip()
    return {"title":f("title"),"rate":f("hourly_rate"),"skills":skills,"overview":ov}

def overview_html(t):
    return "".join(f"<p>{esc(p)}</p>" for p in re.split(r'\n\s*\n', t.strip()) if p.strip())

def initials(n):
    parts=[p for p in n.replace("."," ").split() if p]
    return (parts[0][0]+(parts[1][0] if len(parts)>1 else "")).upper()

tabs=[]; panels=[]
for i,name in enumerate(ORDER):
    cur=read_baseline(name); pr=PROP[name]
    disp,loc,badges=META[name]
    cur_l={s.lower() for s in cur["skills"]}; pr_l={s.lower() for s in pr["skills"]}
    new=[s for s in pr["skills"] if s.lower() not in cur_l]
    dropped=[s for s in cur["skills"] if s.lower() not in pr_l]

    def pills(skills, proposed):
        out=[]
        for s in skills:
            cls="pill"; extra=""
            if proposed and s.lower() not in cur_l:
                cls+=" new"; extra='<span class="dot">＋ new</span>'
            if (not proposed) and s.lower() in SOFT:
                cls+=" soft"; extra='<span class="softtag">auto tag</span>'
            elif (not proposed) and s.lower() not in pr_l:
                cls+=" drop"
            out.append(f'<span class="{cls}">{esc(s)}{extra}</span>')
        return "".join(out)

    def col(label, badge, title, rate, ratenote, ov, skills, cats, proposed):
        tcnt=len(title)
        tcls="ptitle"+(" chg" if proposed else "")
        rn=f'<div class="ratenote">{esc(ratenote)}</div>' if ratenote else ''
        catshtml=("".join(f'<span class="pill cat">{esc(c)}</span>' for c in cats)
                  if cats else '<span class="catnote">not optimized</span>')
        return f'''<div class="col"><div class="collabel">{label}{badge}</div>
        <div class="card">
          <div class="phead"><div class="avatar">{initials(disp)}</div>
            <div><div class="pname">{esc(disp)} <span class="verified">✓</span></div>
            <div class="ploc">{esc(loc)}</div>
            <div class="badges">{"".join(f'<span class="badge">{esc(b)}</span>' for b in badges)}</div></div></div>
          <div class="ratebar"><div><span class="rate">{esc(rate) or "Not set"}</span><span class="rl">/hr</span></div>{rn}</div><hr>
          <div class="sectlabel">Title <span class="cnt">{tcnt}/70</span></div><div class="{tcls}">{esc(title)}</div>
          <div class="sectlabel">Overview</div><div class="overview">{overview_html(ov)}</div>
          <div class="sectlabel">Skills <span class="sc">{len(skills)} / 15</span></div><div class="pills">{pills(skills, proposed)}</div>
          <div class="sectlabel">Categories <span class="sc">{"up to 10" if proposed else ""}</span></div><div class="pills">{catshtml}</div>
        </div></div>'''

    cur_col=col("Current","",cur["title"],cur["rate"],"",cur["overview"],cur["skills"],[],False)
    pr_col =col("Proposed",'<span class="rec">recommended</span>',pr["title"],pr["rate"],pr["ratenote"],pr["overview"],pr["skills"],pr["cats"],True)
    legend=f'''<div class="legend">
      <span><i class="lg new"></i>New ({len(new)}): {esc(", ".join(new)) or "—"}</span>
      <span><i class="lg drop"></i>Dropped ({len(dropped)}): {esc(", ".join(dropped)) or "—"}</span></div>'''
    note=f'<div class="changes"><b>Key changes:</b> {esc(pr["changes"])}</div>'
    panels.append(f'<div class="panel{" active" if i==0 else ""}" id="p-{i}">{note}{legend}<div class="cols">{cur_col}{pr_col}</div></div>')
    tabs.append(f'<button class="tab{" active" if i==0 else ""}" onclick="show({i})">{esc(name)}</button>')

DOC=f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Current vs Proposed — Upwork Profiles</title>
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
</style></head><body>
<div class="top"><h1>Current vs Proposed — Upwork profile preview</h1>
<p>Rendered to mirror an Upwork profile. Left = baseline (from the content doc). Right = recommended rewrite, grounded in the competitor gap analysis. Limits enforced: Title ≤70, Skills ≤15, Categories ≤10.</p></div>
<div class="tabs">{"".join(tabs)}</div>
<div class="wrap">{"".join(panels)}</div>
<script>
function show(i){{document.querySelectorAll('.panel').forEach((p,j)=>p.classList.toggle('active',j===i));
document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('active',j===i));}}
</script></body></html>'''

out=os.path.join(HERE,"profile_current_vs_proposed.html")
open(out,"w",encoding="utf-8").write(DOC)
print("Wrote",out,len(DOC),"bytes")
for name in ORDER:
    print(name,"| proposed title chars:",len(PROP[name]["title"]),"| skills:",len(PROP[name]["skills"]))
