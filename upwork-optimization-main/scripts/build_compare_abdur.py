#!/usr/bin/env python3
import os, html
HERE = os.path.dirname(__file__)

NAME = "Abdur R."
LOC = "Peshawar, Pakistan"
BADGES = ["Top Rated Plus", "100% Job Success", "Rising Talent"]
HOURS = "11,157 total hours"

CUR_TITLE = "AI Engineer & Agent Developer | LLM, RAG & Multi-Agent Systems"
CUR_RATE = "$25.00/hr"
CUR_OVERVIEW = """I am an AI Engineer and AI Agent Developer building production-grade LLM systems, multi-agent architectures, and RAG pipelines that solve real business problems, not demos.

I combine strong Python and FastAPI engineering with modern agent tooling (Claude API, OpenAI, MCP, LangChain, LlamaIndex) to build systems that reason, use tools, retrieve knowledge, and answer reliably at scale.

My focus is on building production-ready AI systems that integrate LLMs with structured data, APIs, and business logic to deliver real value."""
CUR_SKILLS = ['AI Agent Development','LLM Prompt Engineering','LangChain','AI Chatbot','API Integration',
 'Retrieval Augmented Generation','FastAPI','Python','Chatbot Development','OpenAI API','Claude','SQL',
 'Vector Database','Machine Learning','Natural Language Processing','Artificial Intelligence','Generative AI',
 'AI App Development','Clear Communicator']

PROP_TITLE = "AI Engineer | LLM, RAG & AI Agents | Python, FastAPI, LangChain"
PROP_RATE = "$45.00/hr"
PROP_RATE_NOTE = "suggested range $40–$55 (from $25)"
PROP_OVERVIEW = """I build production-grade AI agents, RAG systems, and LLM applications that solve real business problems — not demos. If you need an AI engineer who ships reliable, scalable systems in Python and FastAPI, wired into your own data, APIs, and tools, you're in the right place.

I'm a Top Rated Plus AI engineer with 100% Job Success and 11,000+ hours on Upwork. I combine strong backend engineering with modern agent tooling (Claude, OpenAI, LangChain, LlamaIndex, MCP) to build systems that reason, use tools, retrieve knowledge, and answer reliably at scale.

What I can build for you:
• AI agents and multi-agent systems with tool use and orchestration
• Retrieval-Augmented Generation (RAG) over your documents — semantic search, vector databases, memory
• AI chatbots and copilots grounded in your own data
• LLM-powered backends integrated with your APIs, CRMs, and SaaS tools
• AI automation pipelines (including n8n) and document intelligence (PDF ingestion, ETL, extraction)
• Scalable Python / FastAPI backends — plus full-stack delivery with Next.js, React, and Node.js

Why clients keep working with me: production-first, well-tested systems built for real use; RAG grounded in your data with evaluation so output stays accurate; clear communication and dependable delivery from planning to launch. Anthropic-certified (Model Context Protocol, Building with the Claude API, Claude Code).

Send me a short note about your project and goals — I'll tell you exactly how I'd approach it."""
PROP_SKILLS = ['AI Agent Development','Retrieval Augmented Generation','LangChain','Large Language Model',
 'LLM Prompt Engineering','Generative AI','Artificial Intelligence','Machine Learning','Python','FastAPI',
 'OpenAI API','API Integration','AI Chatbot','Vector Database','Next.js']
PROP_CATEGORIES = ["AI & Machine Learning","Web, Mobile & Software Development","Data Science & Analytics"]

cur_set = set(CUR_SKILLS); prop_set = set(PROP_SKILLS)
new_skills = [s for s in PROP_SKILLS if s not in cur_set]
dropped = [s for s in CUR_SKILLS if s not in prop_set]
SOFT = {"Clear Communicator"}

def esc(s): return html.escape(s, quote=True)
def overview_html(t):
    return "".join(f"<p>{esc(p)}</p>" for p in t.split("\n\n"))

def skill_pills(skills, *, proposed=False):
    out=[]
    for s in skills:
        cls="pill"
        extra=""
        if proposed and s in new_skills:
            cls+=" new"; extra='<span class="dot">＋ new</span>'
        if (not proposed) and s in SOFT:
            cls+=" soft"; extra='<span class="softtag">auto tag</span>'
        if (not proposed) and s in dropped and s not in SOFT:
            cls+=" drop"
        out.append(f'<span class="{cls}">{esc(s)}{extra}</span>')
    return "".join(out)

def initials(n): return "".join(p[0] for p in n.replace("."," ").split()[:2]).upper()

def title_block(title, changed=False):
    cls="ptitle"+(" chg" if changed else "")
    return f'<div class="{cls}">{esc(title)} <span class="cnt">{len(title)}/70</span></div>'

def rate_block(rate, note="", old=False):
    extra=f'<div class="ratenote">{esc(note)}</div>' if note else ''
    return f'<div class="rate">{esc(rate)}<span class="rl">/hr shown</span></div>{extra}'

def col_with_count(label,badge,title_html,rate_html,ov,skills,cats=""):
    return f'''<div class="col">
      <div class="collabel">{label}{badge}</div>
      <div class="card">
        <div class="phead"><div class="avatar">{initials(NAME)}</div>
          <div><div class="pname">{esc(NAME)} <span class="verified">✓</span></div>
          <div class="ploc">{esc(LOC)}</div>
          <div class="badges">{"".join(f'<span class="badge">{esc(b)}</span>' for b in BADGES)}</div></div></div>
        <div class="ratebar">{rate_html}<div class="hours">{esc(HOURS)}</div></div><hr>
        <div class="sectlabel">Title</div>{title_html}
        <div class="sectlabel">Overview</div><div class="overview">{overview_html(ov)}</div>
        <div class="sectlabel">Skills <span class="sc">{len(skills)} / 15</span></div>
        <div class="pills">{skill_pills(skills, proposed=(label=="Proposed"))}</div>
        {cats}
      </div></div>'''

cur_cats = '<div class="sectlabel">Categories</div><div class="catnote">not optimized</div>'
prop_cats = '<div class="sectlabel">Categories <span class="sc">up to 10</span></div><div class="pills">'+\
            "".join(f'<span class="pill cat">{esc(c)}</span>' for c in PROP_CATEGORIES)+'</div>'

cur_col = col_with_count("Current","", title_block(CUR_TITLE,False),
                         rate_block(CUR_RATE), CUR_OVERVIEW, CUR_SKILLS, cur_cats)
prop_col = col_with_count("Proposed",'<span class="rec">recommended</span>',
                          title_block(PROP_TITLE,True),
                          rate_block(PROP_RATE, PROP_RATE_NOTE), PROP_OVERVIEW, PROP_SKILLS, prop_cats)

legend = f'''<div class="legend">
  <span><i class="lg new"></i>New skill ({len(new_skills)}): {esc(", ".join(new_skills))}</span>
  <span><i class="lg drop"></i>Dropped ({len(dropped)}): {esc(", ".join(dropped))}</span>
  <span><i class="lg soft"></i>Soft-skill tag — auto-generated, removed</span>
</div>'''

DOC = f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Abdur R. — Current vs Proposed (Upwork)</title>
<style>
:root{{--green:#14a800;--green-d:#3c8000;--ink:#001e00;--mut:#5e6d55;--line:#d5e0d5;--bg:#f7faf7;--card:#fff;--new:#14a800;--drop:#b9b9b9;--soft:#d98c00;}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55}}
.top{{background:var(--card);border-bottom:1px solid var(--line);padding:16px 22px}}
.top h1{{margin:0;font-size:18px;color:var(--ink)}}
.top p{{margin:3px 0 0;color:var(--mut);font-size:13px}}
.wrap{{max-width:1180px;margin:0 auto;padding:18px}}
.legend{{display:flex;gap:18px;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:var(--mut)}}
.legend i.lg{{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:middle}}
.lg.new{{background:var(--new)}}.lg.drop{{background:var(--drop)}}.lg.soft{{background:var(--soft)}}
.cols{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
@media(max-width:860px){{.cols{{grid-template-columns:1fr}}}}
.collabel{{font-size:13px;font-weight:700;color:var(--mut);margin-bottom:7px;display:flex;align-items:center;gap:8px;text-transform:uppercase;letter-spacing:.05em}}
.rec{{background:var(--green);color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;letter-spacing:.04em}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,40,0,.05)}}
.phead{{display:flex;gap:13px;align-items:flex-start}}
.avatar{{width:52px;height:52px;border-radius:50%;background:var(--green);color:#fff;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}}
.pname{{font-size:17px;font-weight:700}}
.verified{{color:var(--green);font-size:13px}}
.ploc{{color:var(--mut);font-size:12.5px}}
.badges{{margin-top:5px;display:flex;flex-wrap:wrap;gap:6px}}
.badge{{font-size:11px;color:var(--green-d);background:#eaf5e6;border-radius:11px;padding:2px 9px;font-weight:600}}
.ratebar{{display:flex;justify-content:space-between;align-items:baseline;margin-top:14px}}
.rate{{font-size:22px;font-weight:800;color:var(--ink)}}
.rate .rl{{font-size:12px;font-weight:500;color:var(--mut);margin-left:3px}}
.ratenote{{font-size:11.5px;color:var(--green-d);font-weight:600}}
.hours{{color:var(--mut);font-size:12.5px}}
hr{{border:none;border-top:1px solid var(--line);margin:15px 0}}
.sectlabel{{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);font-weight:700;margin:16px 0 7px;display:flex;align-items:center;gap:7px}}
.sc,.cnt{{font-weight:600;color:var(--green-d);text-transform:none;letter-spacing:0}}
.ptitle{{font-size:17px;font-weight:700;color:var(--ink);line-height:1.35}}
.ptitle .cnt{{font-size:11px;margin-left:6px;color:var(--mut)}}
.ptitle.chg{{border-left:3px solid var(--green);padding-left:10px}}
.overview p{{margin:0 0 9px}}
.overview{{font-size:13.5px;color:#2a3a2a}}
.pills{{display:flex;flex-wrap:wrap;gap:7px}}
.pill{{background:#f2f5f2;border:1px solid #e2ebe2;color:#3c4d3c;border-radius:16px;padding:4px 11px;font-size:12.5px}}
.pill.new{{background:#eaf7e6;border-color:#bfe6b0;color:var(--green-d);font-weight:600}}
.pill.new .dot{{font-size:10px;color:var(--green);margin-left:5px}}
.pill.soft{{background:#fff4e3;border-color:#f0d5a6;color:#9a6700}}
.pill.soft .softtag{{font-size:9px;color:#b9820a;margin-left:5px}}
.pill.drop{{opacity:.55;text-decoration:line-through}}
.pill.cat{{background:#eef3fb;border-color:#cfe0f5;color:#2c5fa6}}
.catnote{{color:var(--mut);font-size:12.5px;font-style:italic}}
</style></head><body>
<div class="top"><h1>Abdur R. — profile preview: Current vs Proposed</h1>
<p>Rendered to mirror an Upwork profile. Left = your live profile today. Right = the recommended rewrite. Changes are highlighted.</p></div>
<div class="wrap">
{legend}
<div class="cols">{cur_col}{prop_col}</div>
</div></body></html>'''

out = os.path.join(HERE, "profile_compare_abdur_rehman.html")
open(out,"w",encoding="utf-8").write(DOC)
print("Wrote", out, len(DOC), "bytes")
print("new:",new_skills,"| dropped:",dropped)
print("titles:",len(CUR_TITLE),len(PROP_TITLE),"| overview chars:",len(CUR_OVERVIEW),len(PROP_OVERVIEW))
