#!/usr/bin/env python3
import os, json, html

HERE = os.path.dirname(__file__)

TITLE = "AI Engineer | LLM, RAG & AI Agents | Python, FastAPI, LangChain"

OVERVIEW = """I build production-grade AI agents, RAG systems, and LLM applications that solve real business problems — not demos. If you need an AI engineer who ships reliable, scalable systems in Python and FastAPI, wired into your own data, APIs, and tools, you're in the right place.

I'm a Top Rated Plus AI engineer with 100% Job Success and 11,000+ hours on Upwork. I combine strong backend engineering with modern agent tooling (Claude, OpenAI, LangChain, LlamaIndex, MCP) to build systems that reason, use tools, retrieve knowledge, and answer reliably at scale.

What I can build for you:
- AI agents and multi-agent systems with tool use and orchestration
- Retrieval-Augmented Generation (RAG) over your documents — semantic search, vector databases, memory
- AI chatbots and copilots grounded in your own data
- LLM-powered backends integrated with your APIs, CRMs, and SaaS tools
- AI automation pipelines for operations and analytics (including n8n workflows)
- Document intelligence: PDF ingestion, ETL, structured data extraction
- Scalable Python / FastAPI backends — and full-stack delivery with Next.js, React, and Node.js when you need the whole product

Why clients keep working with me:
- Production-first: clean, maintainable, well-tested systems built for real use, not prototypes
- Reliable RAG grounded in your data, with evaluation so output stays accurate
- Clear communication and dependable delivery from planning to launch

Recent focus: building AI agents, RAG knowledge copilots, and LLM backends for startups and growth teams. Anthropic-certified (Model Context Protocol, Building with the Claude API, Claude Code).

If you want an AI engineer who can take your idea from concept to a working, production system, send me a short note about your project and goals — I'll tell you exactly how I'd approach it."""

SKILLS = [
 ("AI Agent Development","keep"),("Retrieval Augmented Generation","keep"),("LangChain","keep"),
 ("Large Language Model","add"),("LLM Prompt Engineering","keep"),("Generative AI","keep"),
 ("Artificial Intelligence","keep"),("Machine Learning","keep"),("Python","keep"),
 ("FastAPI","keep"),("OpenAI API","keep"),("API Integration","keep"),
 ("AI Chatbot","keep"),("Vector Database","keep"),("Next.js","add"),
]

FLAGGED = [
 ("React","Listed in your Datum Labs roles — swap in when targeting full-stack AI builds."),
 ("Node.js","In your employment history; rotate in for backend/full-stack jobs."),
 ("TypeScript","Used at Datum Labs; add when targeting product/front-end-heavy work."),
 ("PostgreSQL","Used in production at Datum Labs; add for data-backed app roles."),
 ("n8n","You build n8n automations — add when targeting AI-automation jobs."),
 ("Docker","You hold a Docker cert; add for DevOps/deployment-flavored roles."),
 ("Full-Stack Development","True (Full Stack Engineer @ Datum Labs) — strong category, not a skill-tag priority."),
 ("AI Consulting","Add only if you want advisory/consulting inquiries."),
]

CATEGORIES = [
 ("AI & Machine Learning", ["AI Agent Development","AI App Integration","Generative AI Modeling","Chatbot Development","Deep Learning / LLM"]),
 ("Web, Mobile & Software Development", ["Back-End Development","Full-Stack Development","API Development"]),
 ("Data Science & Analytics", ["AI / Data Engineering (RAG, ETL, vector search)"]),
]

RATE = ("$40–$55/hr (from $25/hr)",
 "You're Top Rated Plus with 100% JSS and 11k+ hours, yet priced well below comparable AI engineers in your collected set (e.g. a similar 'AI Engineer | RAG | Agents' profile sits at $80/hr). A move to $40–$55 better signals seniority without pricing out startups. Rate is your call — this is positioning guidance, not financial advice.")

PORTFOLIO = [
 ("RAG Knowledge Copilot for Company Docs","AI Engineer","Built a retrieval-augmented assistant answering from a client's private docs — LlamaIndex + a vector database for semantic search, FastAPI backend, evaluation to keep answers grounded and accurate.",["Retrieval Augmented Generation","LangChain","FastAPI","Python","Vector Database"]),
 ("Multi-Agent Workflow Automation","AI Engineer","Designed an agent system that plans and executes multi-step tasks with tool use and orchestration, integrated with the client's APIs and an n8n automation layer.",["AI Agent Development","LangChain","OpenAI API","API Integration","Python"]),
 ("Production LLM Backend (FastAPI)","Backend / AI Engineer","Shipped a scalable FastAPI service exposing LLM features to a product — prompt engineering, evaluation, and clean integration with the existing app and database.",["FastAPI","Python","Large Language Model","OpenAI API","API Integration"]),
]

SAVED = [
 ("Core — AI Agents","\"AI agent\" OR \"multi-agent\" OR LangChain OR \"agentic\"",
  "Category: AI & Machine Learning · Hourly · Expert/Intermediate · Payment verified · Budget ≥ $30/hr · Posted last 24h",
  "Your top shared strength (AI Agent Development appears in 35 of 90 competitor profiles) and your stated specialty."),
 ("Core — RAG / Knowledge","RAG OR \"retrieval augmented\" OR \"vector database\" OR \"knowledge base\" chatbot",
  "Category: AI & Machine Learning · Hourly + Fixed · Payment verified · Posted last 3 days",
  "RAG is a core differentiator you list and competitors often don't — high-intent, low-competition for you."),
 ("Differentiator — FastAPI AI backend","FastAPI AND (LLM OR OpenAI OR AI) backend OR API",
  "Category: Web, Mobile & Software Development · Hourly · Expert · Budget ≥ $35/hr",
  "FastAPI is in your stack but rarely in competitors' — surfaces backend AI work where you stand out."),
 ("Differentiator — LLM integration","\"LLM integration\" OR \"OpenAI API\" OR \"Claude API\" OR \"ChatGPT integration\"",
  "Hourly + Fixed · Payment verified · Client hire rate ≥ 50%",
  "Captures LLM-backend wiring jobs that match your OpenAI/Claude + API integration strengths."),
 ("Growth — AI automation","\"AI automation\" OR n8n OR Make.com OR \"workflow automation\" AI",
  "Category: AI & Machine Learning / Automation · Hourly + Fixed · Posted last 3 days",
  "Automation appears in 16 competitor profiles (a gap) and you genuinely build n8n workflows."),
 ("Growth — AI MVP / app","\"AI MVP\" OR \"AI app\" OR \"AI product\" (Next.js OR full-stack)",
  "Category: AI & Machine Learning + Software Development · Fixed · Budget ≥ $1,000",
  "Pairs your AI work with real full-stack delivery (Next.js/React/Node from your Datum Labs roles)."),
 ("Adjacent — Document intelligence","(\"document\" OR PDF) AND (extraction OR parsing OR \"data extraction\") AI OR LLM",
  "Hourly + Fixed · Payment verified · Posted last 7 days",
  "Matches your document-intelligence/ETL capability; steady demand, fits RAG skillset."),
]

CHANGES = [
 ("Title leads with role + RAG/LLM/Agents + Python/FastAPI","Puts your highest-search, true keywords first; keeps within 70 chars."),
 ("Added 'Large Language Model' & 'Next.js' to Skills","LLM is core and high-search; Next.js is documented in your Datum Labs roles but was missing from skills."),
 ("Removed 'Clear Communicator' from Skills","It's an AI-generated soft-skill tag (from client reviews) — can't be self-added, so the slot goes to a searchable hard skill."),
 ("Hook rewritten to stand alone in first ~250 chars","Only the first ~2 lines show in search; they now state who you help + the outcome."),
 ("Surfaced full-stack tools as flagged candidates","React/Node/TypeScript/PostgreSQL/n8n/Docker are all in your history — rotate into the 15 slots by target job."),
 ("Rate guidance $40–$55","You're underpriced vs comparable Top Rated Plus AI engineers in your collected set."),
]

def esc(s): return html.escape(s, quote=True)

# build HTML
def copy_block(label, text, note="", count=False):
    cid = "c"+str(abs(hash(label))%99999)
    cnt = f'<span class="cc" id="{cid}cnt"></span>' if count else ''
    script = f'<script>document.getElementById("{cid}cnt").textContent=document.getElementById("{cid}").textContent.length+" chars";</script>' if count else ''
    return f'''<div class="field"><div class="flabel">{esc(label)} {cnt}</div>
      <div class="copywrap"><pre id="{cid}" class="copytext">{esc(text)}</pre>
      <button class="copybtn" onclick="cp('{cid}',this)">Copy</button></div>
      {f'<div class="fnote">{esc(note)}</div>' if note else ''}{script}</div>'''

skills_line = ", ".join(s for s,_ in SKILLS)
skills_items = "".join(
  f'<li>{esc(s)} <span class="tag {k}">{ "new" if k=="add" else "keep"}</span></li>' for s,k in SKILLS)
flag_items = "".join(f'<li><b>{esc(s)}</b> — {esc(r)}</li>' for s,r in FLAGGED)
cat_items = "".join(
  f'<div class="catbox"><h4>{esc(c)}</h4><div class="subs">{"".join(f"<span>{esc(x)}</span>" for x in subs)}</div></div>'
  for c,subs in CATEGORIES)
port_items = "".join(
  f'''<div class="port"><div class="ph">{esc(t)} <span class="prole">— {esc(role)}</span></div>
      <div class="pdesc">{esc(desc)}</div>
      <div class="ptags">{"".join(f"<span>{esc(x)}</span>" for x in tags)}</div></div>'''
  for t,role,desc,tags in PORTFOLIO)
saved_rows = "".join(
  f'''<div class="srow"><div class="sname">{esc(n)}</div>
      <div class="copywrap sm"><pre id="sv{i}" class="copytext">{esc(q)}</pre><button class="copybtn" onclick="cp('sv{i}',this)">Copy</button></div>
      <div class="sfilt"><b>Filters:</b> {esc(f)}</div>
      <div class="swhy">{esc(w)}</div></div>'''
  for i,(n,q,f,w) in enumerate(SAVED))
change_rows = "".join(f'<tr><td>{esc(c)}</td><td>{esc(w)}</td></tr>' for c,w in CHANGES)

DOC = f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Abdur Rehman — Upwork Profile Proposal</title>
<style>
:root{{--bg:#0f1420;--panel:#161d2e;--line:#2a3550;--ink:#e8edf7;--mut:#93a0bd;--ac:#4f8cff;--gr:#28c896;--or:#ff7a59;}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:14px;line-height:1.5}}
.wrap{{max-width:880px;margin:0 auto;padding:26px 22px 70px}}
h1{{font-size:21px;margin:0 0 2px}}h2{{font-size:16px;margin:26px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}}
.sub{{color:var(--mut);font-size:13px;margin-bottom:6px}}
.pos{{background:#10182a;border-left:3px solid var(--ac);padding:10px 13px;border-radius:6px;margin:10px 0 4px;color:#cdd8f0}}
.field{{margin:14px 0}}.flabel{{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-bottom:5px}}
.cc{{text-transform:none;letter-spacing:0;color:var(--gr);font-weight:600;margin-left:6px}}
.copywrap{{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:9px}}
.copytext{{margin:0;padding:13px 70px 13px 14px;white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:13.5px;color:var(--ink)}}
.copybtn{{position:absolute;top:9px;right:9px;background:var(--ac);color:#07101f;border:none;border-radius:6px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:12px}}
.copybtn:hover{{filter:brightness(1.1)}}.copybtn.ok{{background:var(--gr)}}
.fnote{{color:var(--mut);font-size:12px;margin-top:5px}}
ul.sk{{list-style:none;padding:0;margin:6px 0;columns:2;gap:14px}}@media(max-width:600px){{ul.sk{{columns:1}}}}
ul.sk li{{padding:3px 0}}.tag{{font-size:10px;padding:1px 6px;border-radius:5px;margin-left:4px}}
.tag.add{{background:#1d3a5f;color:#7db4ff}}.tag.keep{{background:#1d3b32;color:#6fd9b3}}
.flag{{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:12px 14px}}
.flag ul{{margin:6px 0 0;padding-left:18px}}.flag li{{margin:5px 0;color:#cdd8f0;font-size:13px}}
.catbox{{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:10px 13px;margin-bottom:8px}}
.catbox h4{{margin:0 0 6px;font-size:13.5px;color:var(--ac)}}.subs span,.ptags span,.srow .sfilt b{{font-size:12px}}
.subs span{{display:inline-block;background:#10182a;border:1px solid var(--line);border-radius:14px;padding:2px 9px;margin:2px 4px 2px 0;color:#cdd8f0}}
.port{{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:11px 13px;margin-bottom:8px}}
.ph{{font-weight:700}}.prole{{color:var(--mut);font-weight:400}}.pdesc{{color:#cdd8f0;font-size:13px;margin:4px 0}}
.ptags span{{display:inline-block;background:#10182a;border:1px solid var(--line);border-radius:5px;padding:1px 7px;margin:2px 4px 0 0;color:var(--mut)}}
.srow{{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:11px 13px;margin-bottom:9px}}
.sname{{font-weight:700;margin-bottom:6px}}.sm .copytext{{font-size:12.5px}}.sfilt{{color:#cdd8f0;font-size:12.5px;margin-top:6px}}.swhy{{color:var(--mut);font-size:12px;margin-top:4px}}
table{{width:100%;border-collapse:collapse;margin-top:8px}}td{{border:1px solid var(--line);padding:8px 10px;font-size:13px;vertical-align:top}}td:first-child{{font-weight:600;width:42%}}
.rate{{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:12px 14px}}.rate .big{{font-size:18px;font-weight:800;color:var(--gr)}}
.warn{{background:#241a10;border:1px solid #5a3d18;color:#e8c89a;padding:9px 13px;border-radius:8px;font-size:12.5px;margin:8px 0}}
</style></head><body><div class="wrap">
<h1>Upwork Profile Proposal — Abdur Rehman</h1>
<div class="sub">Generated from baseline + comparison analysis (90 collected profiles). All limits per Upwork guidelines. Click <b>Copy</b> on any field.</div>
<div class="pos"><b>Target positioning:</b> Production-focused AI engineer building AI agents, RAG systems, and LLM backends in Python/FastAPI for startups and growth teams that need reliable, shipped systems — not prototypes.</div>

<h2>1 · Title <span class="sub" style="font-weight:400">(max 70 chars)</span></h2>
{copy_block("Profile Title", TITLE, count=True)}

<h2>2 · Overview / Description <span class="sub" style="font-weight:400">(max 5,000 chars; first ~250 show in search)</span></h2>
{copy_block("Overview", OVERVIEW, "Tip: the first two lines above are your search snippet — they stand alone as the hook.", count=True)}

<h2>3 · Skills <span class="sub" style="font-weight:400">(max 15 — soft-skill tags excluded)</span></h2>
{copy_block("Skills (comma-separated, paste-ready)", skills_line)}
<ul class="sk">{skills_items}</ul>
<div class="warn">Removed <b>Clear Communicator</b> — it's an AI-generated soft-skill tag from client reviews and can't be added manually.</div>
<div class="flag"><b>Strong candidates to rotate in</b> (all supported by your history — swap by target job):<ul>{flag_items}</ul></div>

<h2>4 · Categories <span class="sub" style="font-weight:400">(separate field; up to 10)</span></h2>
{cat_items}

<h2>5 · Suggested hourly rate</h2>
<div class="rate"><div class="big">{esc(RATE[0])}</div><div class="fnote" style="margin-top:6px">{esc(RATE[1])}</div></div>

<h2>6 · Portfolio item suggestions <span class="sub" style="font-weight:400">(Title ≤70 · Role ≤100 · Desc ≤600 · ≤5 tags)</span></h2>
{port_items}

<h2>7 · Saved searches (recommended)</h2>
{saved_rows}

<h2>8 · What changed & why</h2>
<table><tr><td>Change</td><td>Why (from the analysis)</td></tr>{change_rows}</table>

</div>
<script>
function cp(id,btn){{const t=document.getElementById(id).textContent;navigator.clipboard.writeText(t).then(()=>{{const o=btn.textContent;btn.textContent="Copied";btn.classList.add("ok");setTimeout(()=>{{btn.textContent=o;btn.classList.remove("ok");}},1200);}});}}
</script></body></html>'''

out = os.path.join(HERE, "profile_proposal_abdur_rehman.html")
open(out,"w",encoding="utf-8").write(DOC)
print("Wrote", out, len(DOC), "bytes")
print("Title chars:", len(TITLE), "| Overview chars:", len(OVERVIEW), "| Skills:", len(SKILLS))
EOF=1
