#!/usr/bin/env python3
import os, html, re
HERE=os.path.dirname(__file__)

# Quoting convention:
#  - single token  -> unquoted        (LangChain, Snowflake, dbt)
#  - multi-word     -> "exact phrase"  ("data pipeline")
#  - alternatives   -> joined with OR  ("AI agent" OR "AI agents")
# name -> (title, rate, {group: [keywords]})
DATA={
 "Abdur Rehman":("AI Engineer & Agent Developer | LLM, RAG & Multi-Agent Systems","$25.00/hr",[
  ("Core",['"AI agent" OR "AI agents"','"multi-agent" OR agentic','RAG OR "retrieval augmented generation"','LLM OR "large language model"','"AI chatbot" OR copilot','"generative AI"']),
  ("Stack / tools",['LangChain','LlamaIndex','"OpenAI API" OR GPT','"Claude API" OR Anthropic','FastAPI','"vector database" OR Pinecone OR Qdrant','MCP OR "Model Context Protocol"','embeddings OR "semantic search"']),
  ("Differentiators",['"RAG pipeline" OR "knowledge base chatbot"','"multi-agent system" OR "agent orchestration"','"prompt engineering" OR "LLM evaluation"','"document intelligence" OR "PDF extraction"','"AI MVP" OR "production AI"','"tool use" OR "AI orchestration"']),
  ("Services / deliverables",['"AI automation" OR "workflow automation"','n8n OR "Make.com"','"LLM integration" OR "AI integration"','"chatbot development"','"API integration"']),
  ("Growth / gaps",['"Next.js" OR "full-stack AI"','"AI consulting" OR "AI strategy"','"AI SaaS" OR "AI feature"','"conversational AI" OR NLP','"AI engineer" OR "AI developer"']),
 ]),
 "Hadiqa":("BI & Analytics Engineer | dbt + Hex | BigQuery & Snowflake Specialist","$20.00/hr",[
  ("Core",['"Power BI"','Tableau','"Looker Studio" OR "Google Data Studio"','BI OR "business intelligence"','"data dashboard" OR "analytics dashboard"','dbt']),
  ("Stack / tools",['BigQuery','Snowflake','SQL','Hex OR Metabase','Python OR Pandas','ClickHouse OR Redshift','Fivetran OR Airbyte OR dlt','Dagster OR "data orchestration"']),
  ("Differentiators",['"modern data stack"','"data warehouse"','"data modeling"','ETL OR "ELT pipeline"','"analytics engineer" OR "BI engineer"']),
  ("Services / deliverables",['"dashboard development" OR "reporting dashboard"','"revenue analytics" OR "product analytics"','churn OR "cohort analysis"','"KPI dashboard" OR "executive dashboard"','"data pipeline" OR "data integration"']),
  ("Growth / gaps",['"Microsoft Excel" OR "Google Sheets"','"Google Analytics" OR GA4','"automated reporting" OR "data automation"','"SaaS analytics" OR "startup analytics"','"AI analytics" OR "sentiment analysis"','Metabase OR Superset']),
 ]),
 "Haris":("Real-time Data Engineer | Kafka, Snowflake, dbt | SaaS Data","",[
  ("Core",['"data engineer" OR "data engineering"','ETL OR "ELT pipeline"','"real-time" OR "streaming data"','"Apache Kafka" OR Kafka','"data pipeline"','dbt']),
  ("Stack / tools",['Snowflake','BigQuery','ClickHouse','"Apache Airflow" OR Airflow','Python','SQL','AWS OR "AWS Lambda"','"Google Cloud" OR GCP']),
  ("Differentiators",['CDC OR "change data capture"','"event-driven" OR "streaming pipeline"','"data warehouse" OR "data lake"','"data modeling"','"real-time analytics"','"scalable pipeline" OR "high-volume data"']),
  ("Services / deliverables",['"data ingestion" OR "pipeline development"','"SaaS data" OR "fintech data"','Fivetran OR Airbyte','Dagster OR Prefect','"data quality" OR "pipeline monitoring"']),
  ("Growth / gaps",['"Power BI" OR Tableau','PostgreSQL','Docker OR Kubernetes','"Looker Studio" OR Looker','"data integration" OR "data migration"']),
 ]),
 "Humayun":("Data Engineer & Full-Stack Developer | Analytics & SaaS Applications","$45.00/hr",[
  ("Core",['"full-stack" OR "full stack developer"','"SaaS development" OR "SaaS app"','"Next.js"','React','"web application" OR "web app"','"Node.js"']),
  ("Stack / tools",['TypeScript','JavaScript','PostgreSQL','Supabase','"REST API" OR "RESTful API"','"Tailwind CSS"','Stripe','"OpenAI API"']),
  ("Differentiators",['"admin panel" OR "internal tool"','"client portal" OR "customer portal"','"multi-tenant"','RBAC OR "role-based access"','"embedded analytics" OR "analytics dashboard"']),
  ("Services / deliverables",['MVP OR "SaaS MVP"','"API integration"','"dashboard development"','CRM OR "workflow automation"','"AI feature" OR "AI automation"']),
  ("Growth / gaps",['"web development"','"software development" OR "software architecture"','fintech OR "e-commerce"','"AI development" OR "Artificial Intelligence"','MySQL OR MongoDB','"database development" OR "database design"']),
 ]),
 "Nidal":("Data Engineer | ETL Developer | Airflow, dbt, Snowflake | AWS GCP","",[
  ("Core",['"data engineer" OR "data engineering"','ETL OR "ELT pipeline"','"data pipeline"','"Apache Airflow" OR Airflow','dbt','"data warehouse"']),
  ("Stack / tools",['Snowflake','BigQuery','"Amazon Redshift" OR Redshift','ClickHouse','"Apache Kafka" OR Kafka','Python','SQL','PostgreSQL']),
  ("Differentiators",['AWS OR "AWS data engineering"','GCP OR "Google Cloud"','Azure','Docker OR Kubernetes','Databricks']),
  ("Services / deliverables",['"real-time" OR "stream processing"','"data integration" OR "data migration"','"data lakehouse" OR "data lake"','"pipeline orchestration"','"data platform" OR DevOps']),
  ("Growth / gaps",['"data modeling"','Fivetran OR Airbyte','"Power BI" OR Tableau','"data warehousing"','Terraform OR "infrastructure as code"','"data quality" OR observability']),
 ]),
}

def esc(s): return html.escape(s, quote=True)

tabs=[]; panels=[]
for i,(name,(title,rate,groups)) in enumerate(DATA.items()):
    flat=[kw for _,kws in groups for kw in kws]
    assert len(flat)==30, f"{name} has {len(flat)} keywords"
    gblocks=[]; n=0; allkws=[]
    for gname,kws in groups:
        rows=[]
        for kw in kws:
            n+=1; allkws.append(kw)
            kid=f"k{i}_{n}"
            rows.append(f'<div class="kw"><span class="num">{n}</span><code id="{kid}">{esc(kw)}</code>'
                        f'<button class="cp" onclick="cp(\'{kid}\',this)">Copy</button></div>')
        gblocks.append(f'<div class="grp"><div class="gname">{esc(gname)}</div>{"".join(rows)}</div>')
    alltext=esc("\n".join(allkws))
    panels.append(f'''<div class="panel{" active" if i==0 else ""}" id="p{i}">
      <div class="phead"><div><div class="pname">{esc(name)}</div><div class="ptitle">{esc(title)}</div></div>
      <div class="right"><span class="rate">{esc(rate) or "rate not set"}</span>
      <button class="cpall" onclick="cpall({i},this)">Copy all 30</button></div></div>
      <textarea id="all{i}" class="hidden">{alltext}</textarea>
      {"".join(gblocks)}</div>''')
    tabs.append(f'<button class="tab{" active" if i==0 else ""}" onclick="show({i})">{esc(name)}</button>')

DOC=f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Upwork Saved-Search Keywords</title>
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
<div class="top"><h1>Upwork Saved-Search Keywords — 30 per person</h1>
<p>Grounded in each baseline and the competitor gap analysis. Grouped Core / Stack / Differentiators / Services / Growth.</p></div>
<div class="conv">Quoting convention: single words are unquoted (<code>LangChain</code>); multi-word phrases are quoted exactly (<code>"data pipeline"</code>); alternatives are joined with <code>OR</code> (<code>"Power BI" OR Tableau</code>). Click to copy a keyword, or "Copy all 30".</div>
<div class="tabs">{"".join(tabs)}</div>
<div class="wrap">{"".join(panels)}</div>
<script>
function show(i){{document.querySelectorAll('.panel').forEach((p,j)=>p.classList.toggle('active',j===i));
document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('active',j===i));}}
function flash(b,t){{const o=b.textContent;b.textContent=t;b.classList.add('ok');setTimeout(()=>{{b.textContent=o;b.classList.remove('ok');}},1100);}}
function cp(id,b){{navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>flash(b,'Copied'));}}
function cpall(i,b){{navigator.clipboard.writeText(document.getElementById('all'+i).value).then(()=>flash(b,'Copied all'));}}
</script></body></html>'''

out=os.path.join(HERE,"upwork_saved_search_keywords.html")
open(out,"w",encoding="utf-8").write(DOC)
print("Wrote",out,len(DOC),"bytes")
# validate convention: no unquoted multi-word terms outside OR tokens
def check(kw):
    # split on OR, each part must be a single token or fully quoted
    for part in re.split(r'\s+OR\s+', kw):
        part=part.strip()
        if part.startswith('"') and part.endswith('"'): continue
        if ' ' in part: return False
    return True
bad=[(n,kw) for n,(t,r,g) in DATA.items() for _,ks in g for kw in ks if not check(kw)]
print("convention violations:", bad)
for name,(t,r,g) in DATA.items(): print(name, sum(len(k) for _,k in g))
