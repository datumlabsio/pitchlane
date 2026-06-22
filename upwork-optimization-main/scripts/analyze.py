#!/usr/bin/env python3
"""Upwork profile comparison: extract tools/skills, compute six signals per person.

Methodology
-----------
- Canonical extraction source = each profile's structured `skills:` frontmatter list.
  This is present and symmetric for the baseline and every collected profile, so the
  comparison is apples-to-apples (the prompt requires identical extraction rules for
  baseline and collected). The baseline.md files were built to mirror this structure
  from the live Upwork profiles.
- Normalize: lowercase, trim, collapse known variants. Keep a clean display label.
- Classify each normalized term as a TOOL (named technology/product/framework/language)
  or a SKILL (capability/service/method) via a curated dictionary; default = skill.
- For each person, compare baseline vs each collected profile and compute the six signals.
"""
import os, re, glob, json, collections

ROOT = os.path.join(os.path.dirname(__file__), "profiles")

# ---------------------------------------------------------------------------
# Normalization: variant -> canonical normalized key
# ---------------------------------------------------------------------------
ALIASES = {
    "js": "javascript",
    "ts": "typescript",
    "node": "node.js",
    "nodejs": "node.js",
    "nodejs framework": "node.js",
    "node js": "node.js",
    "reactjs": "react",
    "react.js": "react",
    "nextjs": "next.js",
    "next js": "next.js",
    "vuejs": "vue.js",
    "vue": "vue.js",
    "ps": "photoshop",
    "adobe photoshop": "photoshop",
    "gcp": "google cloud platform",
    "aws": "amazon web services",
    "ga": "google analytics",
    "ga4": "google analytics 4",
    "power bi": "microsoft power bi",
    "powerbi": "microsoft power bi",
    "ms excel": "microsoft excel",
    "excel": "microsoft excel",
    "postgres": "postgresql",
    "vba": "visual basic for applications",
    "t-sql": "transact-sql",
    "tsql": "transact-sql",
    "gpt-4": "gpt-4",
    "chatgpt api": "openai api",
    "gpt api": "openai api",
    "openai codex": "openai api",
    "go": "golang",
    "rails": "ruby on rails",
    "scss": "sass",
}

def norm(term):
    t = term.strip().lower()
    t = t.replace("​", "").strip()
    t = re.sub(r"\s+", " ", t)
    return ALIASES.get(t, t)

# ---------------------------------------------------------------------------
# TOOLS dictionary (normalized). Anything not here is treated as a SKILL.
# ---------------------------------------------------------------------------
TOOLS = set(map(norm, [
    # Languages
    "Python","JavaScript","TypeScript","PHP","C#","R","Java","C++","SQL","Golang","Scala",
    "Solidity","Swift","Kotlin","Dart","Ruby on Rails","Bash Programming","XML","Visual Basic",
    "Visual Basic for Applications","Transact-SQL","Apex","Delphi","SAS","Stata","Scala","SQL Programming",
    "PostgreSQL Programming","MySQL Programming","Microsoft SQL Server Programming","Low-Level Programming",
    # Web frameworks / libs
    "React","Node.js","Next.js","Django","Flask","FastAPI","Laravel","Vue.js","Angular","AngularJS",
    "jQuery","Redux","React Native","Spring Boot","NestJS","ExpressJS","Ruby on Rails",".NET Framework",
    ".NET Core","ASP.NET","ASP.NET MVC","Symfony","CodeIgniter","Ionic Framework","Gatsby.js","Tailwind CSS",
    "Bootstrap","React Bootstrap","Sass","GSAP","Three.js","WebGL","Fabric.js","D3.js","Chart.js","Plotly",
    "Dash","R Shiny","Celery","Puppeteer","Selenium","Scrapy","NumPy","pandas","SciPy","Python Scikit-Learn",
    "PyTorch","TensorFlow","XGBoost","Hugging Face","OpenCV","Jest","Flutter","FlutterFlow","MERN Stack",
    "Django Stack","Akka","HTML","HTML5","CSS","CSS 3","Matplotlib","Spring Boot","Google Polymer","Web Component",
    "Drupal","Magento","Magento 2","WooCommerce","Elementor","Gatsby.js",
    # Data eng / big data
    "Apache Spark","Apache Beam","Apache Kafka","Apache Airflow","Apache Cassandra","Elasticsearch","Redis",
    "RabbitMQ","dbt","Fivetran","Dagster","Databricks Platform","PySpark","Big Data","Google Dataflow",
    "MLflow","Grafana","Tesseract OCR","Alteryx","Apache Superset","Superset","Prefect","Prometheus",
    "Airbyte","dlt","ClickHouse","Data Lake",
    # Databases
    "PostgreSQL","MySQL","MongoDB","Microsoft SQL Server","Snowflake","BigQuery","Supabase","Firebase",
    "MariaDB","Amazon RDS","Amazon Aurora","Amazon Redshift","IBM Informix","Vector Database","Pinecone",
    "ClickHouse","NoSQL Database","Oracle NetSuite","Microsoft Access",
    # Cloud / devops
    "Amazon Web Services","AWS Lambda","AWS Amplify","Amazon EC2","Microsoft Azure","Microsoft Azure SQL Database",
    "Azure OpenAI Service","Azure Machine Learning","Google Cloud Platform","Docker","Docker Compose","Kubernetes",
    "Terraform","Jenkins","Vercel","NGINX","Git","GitHub","Linux","Red Hat Enterprise Linux","Google AutoML",
    "AWS Systems Manager","Microsoft Intune","Microsoft Windows PowerShell",
    # BI / analytics tools
    "Microsoft Power BI","Tableau","Looker","Looker Studio","Metabase","HEX","Superset","Klipfolio","Sisense",
    "Amazon QuickSight","Domo","Power Query","Google Analytics","Google Analytics 4","Google Tag Manager",
    "Mixpanel","Amplitude","Adobe Analytics","Supermetrics","IBM SPSS","Microsoft Excel","Google Sheets",
    "Microsoft 365 Copilot","Microsoft Power Automate","Microsoft PowerApps","Microsoft SQL SSAS",
    "SQL Server Integration Services","Microsoft SQL Server Reporting Services","Data Analysis Expressions",
    "Microsoft Excel PowerPivot","Piwik PRO","Fabric","Microsoft Power BI Data Visualization",
    "Microsoft Power BI Development",
    # AI / LLM tools & platforms
    "OpenAI API","ChatGPT","GPT-4","GPT-3","Claude","Gemini","LangChain","LlamaIndex","n8n","Make.com","Zapier",
    "Midjourney AI","Stable Diffusion","Replit","ElevenLabs","Runway Gen-2","Kaiber","Topaz Photo AI","Agent GPT",
    "Hugging Face","AI Builder",
    # SaaS / CMS / commerce / CRM platforms
    "Shopify","WordPress","Wix","Squarespace","BigCommerce","OpenCart","Bubble.io","Airtable","Stripe","Stripe API",
    "Stripe SDK","PayPal","Twilio API","HubSpot","Salesforce","Salesforce CRM","Salesforce Lightning",
    "Salesforce Einstein","Salesforce Sales Cloud","Salesforce Service Cloud","Salesforce Marketing Cloud",
    "Salesforce CPQ","Pardot Marketing","Commerce Cloud","Data Cloud","Mulesoft","Zoho CRM","Zoho Creator",
    "Zoho Analytics","Zoho Books","Zoho Projects","Zoho Desk","Zoho Recruit","Zoho Sprints","Zoho Platform",
    "NetSuite Development","Oracle NetSuite","Marketo","ActiveCampaign","HighLevel","Asana","Smartsheet","ClickUp",
    "Salesforce App Development","Dell Boomi","Intuit QuickBooks","Google Ads","Google Search Console",
    "Google Apps Script","Facebook Ads Manager","Meta Pixel","Google Places API","Instagram API","Facebook Graph API",
    "Jotform","Google Forms","WhatsApp","Instagram","Contentful","Webflow","WordPress Development",
    # Design / 3D tools
    "Figma","Photoshop","Adobe Illustrator","Adobe After Effects","Adobe Premiere Pro","Adobe Captivate","SketchUp",
    "Framer","UXPin","Blender","V-Ray","KeyShot","Lumion","Chaos Corona","Autodesk 3ds Max","Maxon Cinema 4D",
    "Cycles Render","Microsoft Visio","Microsoft PowerPoint","Microsoft Word","Microsoft Office","3Design",
    # GIS
    "ArcGIS","QGIS","PostGIS","Mapbox","GIS","Lidar",
    # Blockchain
    "Ethereum","Solana","Solidity","Blockchain",
    # misc named tech
    "GraphQL","OAuth","Redis","Spreadsheet Software",
]))

def classify(term_norm):
    return "tool" if term_norm in TOOLS else "skill"

# ---------------------------------------------------------------------------
# Parse profiles
# ---------------------------------------------------------------------------
def parse_profile(path):
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    m = re.search(r"^---\s*\n(.*?)\n---", txt, re.S)
    fm = m.group(1) if m else ""
    def field(name):
        mm = re.search(rf"^{name}:[ \t]*(.*)$", fm, re.M)
        return mm.group(1).strip() if mm else ""
    sk = re.search(r"^skills:\s*\[(.*?)\]", fm, re.S | re.M)
    skills_raw = []
    if sk:
        skills_raw = [s.strip().strip('"').strip("'") for s in sk.group(1).split(",") if s.strip()]
    # dedupe within profile by normalized key, keep first display label
    tools, skills = {}, {}
    for raw in skills_raw:
        n = norm(raw)
        if not n:
            continue
        bucket = tools if classify(n) == "tool" else skills
        bucket.setdefault(n, raw)  # keep clean display label
    return {
        "name": field("name"),
        "title": field("title"),
        "hourly_rate": field("hourly_rate"),
        "url": field("url"),
        "tools": tools,   # normkey -> label
        "skills": skills,
    }

def signals(base, coll):
    bk, ck = set(base), set(coll)
    base_only = sorted(base[k] for k in (bk - ck))
    coll_only = sorted(coll[k] for k in (ck - bk))
    shared = sorted(base[k] for k in (bk & ck))
    total_distinct = len(bk | ck)
    ratio = (len(bk & ck) / total_distinct) if total_distinct else 0.0
    return {
        "base_only": base_only, "coll_only": coll_only, "shared": shared,
        "n_base_only": len(base_only), "n_coll_only": len(coll_only), "n_shared": len(shared),
        "overlap_ratio": round(ratio, 3), "total_distinct": total_distinct,
    }

# ---------------------------------------------------------------------------
# Build per-person analysis
# ---------------------------------------------------------------------------
people = []
skipped = []
gap_tools_all, gap_skills_all = {}, {}

for person in sorted(os.listdir(ROOT)):
    pdir = os.path.join(ROOT, person)
    if not os.path.isdir(pdir):
        continue
    base_path = os.path.join(pdir, "baseline.md")
    others = sorted(p for p in glob.glob(os.path.join(pdir, "*.md"))
                    if os.path.basename(p) != "baseline.md")
    if not os.path.exists(base_path):
        skipped.append({"person": person, "reason": "no baseline.md", "collected": len(others)})
        continue
    if not others:
        skipped.append({"person": person, "reason": "no collected profiles", "collected": 0})
        continue
    base = parse_profile(base_path)
    comparisons = []
    # frequency aggregates across the collected set, for all six signals
    agg = {
        "tools_shared": collections.Counter(),
        "tools_base_only": collections.Counter(),
        "tools_coll_only": collections.Counter(),
        "skills_shared": collections.Counter(),
        "skills_base_only": collections.Counter(),
        "skills_coll_only": collections.Counter(),
    }
    for op in others:
        c = parse_profile(op)
        tsig = signals(base["tools"], c["tools"])
        ssig = signals(base["skills"], c["skills"])
        for lbl in tsig["shared"]:    agg["tools_shared"][lbl] += 1
        for lbl in tsig["base_only"]: agg["tools_base_only"][lbl] += 1
        for lbl in tsig["coll_only"]: agg["tools_coll_only"][lbl] += 1
        for lbl in ssig["shared"]:    agg["skills_shared"][lbl] += 1
        for lbl in ssig["base_only"]: agg["skills_base_only"][lbl] += 1
        for lbl in ssig["coll_only"]: agg["skills_coll_only"][lbl] += 1
        comparisons.append({
            "file": os.path.basename(op),
            "name": c["name"], "title": c["title"], "hourly_rate": c["hourly_rate"], "url": c["url"],
            "tools": tsig, "skills": ssig,
        })
    people.append({
        "person": person,
        "baseline": {
            "name": base["name"], "title": base["title"], "hourly_rate": base["hourly_rate"], "url": base["url"],
            "tools": sorted(base["tools"].values()), "skills": sorted(base["skills"].values()),
            "n_tools": len(base["tools"]), "n_skills": len(base["skills"]),
        },
        "n_collected": len(others),
        "comparisons": comparisons,
        "rollup": {k: v.most_common(15) for k, v in agg.items()},
        # kept for backward compat
        "gap_tools": agg["tools_coll_only"].most_common(20),
        "gap_skills": agg["skills_coll_only"].most_common(20),
        "avg_tool_overlap": round(sum(c["tools"]["overlap_ratio"] for c in comparisons)/len(comparisons), 3),
        "avg_skill_overlap": round(sum(c["skills"]["overlap_ratio"] for c in comparisons)/len(comparisons), 3),
    })

out = {"people": people, "skipped": skipped, "generated": "2026-06-16"}
with open(os.path.join(os.path.dirname(__file__), "analysis_data.json"), "w") as f:
    json.dump(out, f, indent=1)

# console summary
for p in people:
    print(f"\n=== {p['person']} === baseline: {p['baseline']['n_tools']} tools, {p['baseline']['n_skills']} skills; {p['n_collected']} collected")
    print(f"  avg tool overlap {p['avg_tool_overlap']}, avg skill overlap {p['avg_skill_overlap']}")
    print(f"  top missing tools: {[t for t,_ in p['gap_tools'][:8]]}")
    print(f"  top missing skills: {[s for s,_ in p['gap_skills'][:8]]}")
for s in skipped:
    print(f"SKIPPED {s['person']}: {s['reason']}")
print("\nWrote analysis_data.json")
