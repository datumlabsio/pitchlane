#!/usr/bin/env python3
"""Single-baseline analysis: Faizan K. (live Upwork profile) vs the 100 collected
profiles in profiles/by-skill/.

Methodology mirrors scripts/analyze.py (same ALIASES / TOOLS dictionary / norm /
classify / six-signal logic) so it is consistent with the rest of the toolkit.
Extraction source = each profile's structured `skills:` frontmatter list, which is
symmetric across baseline and collected profiles (apples-to-apples per the prompt).
"""
import os, re, glob, json, collections

HERE = os.path.dirname(__file__)
BYSKILL = os.path.join(HERE, "..", "profiles", "by-skill")
BASELINE_FILE = "_baseline_faizan.md"

ALIASES = {
    "js": "javascript", "ts": "typescript", "node": "node.js", "nodejs": "node.js",
    "nodejs framework": "node.js", "node js": "node.js", "reactjs": "react", "react.js": "react",
    "nextjs": "next.js", "next js": "next.js", "vuejs": "vue.js", "vue": "vue.js",
    "ps": "photoshop", "adobe photoshop": "photoshop", "gcp": "google cloud platform",
    "aws": "amazon web services", "ga": "google analytics", "ga4": "google analytics 4",
    "power bi": "microsoft power bi", "powerbi": "microsoft power bi", "ms excel": "microsoft excel",
    "excel": "microsoft excel", "postgres": "postgresql", "vba": "visual basic for applications",
    "t-sql": "transact-sql", "tsql": "transact-sql", "chatgpt api": "openai api",
    "gpt api": "openai api", "openai codex": "openai api", "go": "golang", "rails": "ruby on rails",
    "scss": "sass", "google data studio": "looker studio", "data studio": "looker studio",
    "ms sql server": "microsoft sql server", "sql server": "microsoft sql server",
    "power query": "power query", "amazon web services (aws)": "amazon web services",
}

def norm(term):
    t = term.strip().lower().replace("​", "").strip()
    t = re.sub(r"\s+", " ", t)
    return ALIASES.get(t, t)

TOOLS = set(map(norm, [
    # Languages
    "Python","JavaScript","TypeScript","PHP","C#","R","Java","C++","SQL","Golang","Scala",
    "Solidity","Swift","Kotlin","Dart","Ruby on Rails","Bash Programming","Visual Basic",
    "Visual Basic for Applications","Transact-SQL","SAS","SQL Programming","PostgreSQL Programming",
    "MySQL Programming","Microsoft SQL Server Programming","Perl","Ruby","Groovy",
    # Web frameworks / libs
    "React","Node.js","Next.js","Django","Flask","FastAPI","Laravel","Vue.js","Angular","AngularJS",
    "jQuery","Redux","React Native","Spring Boot","Spring Framework","NestJS","ExpressJS",".NET Framework",
    ".NET Core","ASP.NET","ASP.NET MVC","Symfony","CodeIgniter","Tailwind CSS","Bootstrap","React Bootstrap",
    "Sass","Three.js","D3.js","Chart.js","Plotly","Dash","Celery","Puppeteer","Selenium","Scrapy",
    "NumPy","pandas","Python Scikit-Learn","PyTorch","TensorFlow","Keras","Hugging Face","OpenCV","Flutter",
    "FlutterFlow","MERN Stack","HTML","HTML5","CSS","CSS 3","Matplotlib","Seaborn","Hibernate","JavaFX",
    "Webflow","Drupal","Magento","WooCommerce","Elementor","SQLAlchemy","pytest","Beautiful Soup",
    # Data eng / big data
    "Apache Spark","Apache Beam","Apache Kafka","Apache Airflow","Apache Hadoop","Apache Cassandra",
    "Apache NiFi","Elasticsearch","Redis","dbt","Fivetran","Dagster","Databricks Platform","PySpark",
    "Big Data","MLflow","Grafana","Alteryx","Apache Superset","Prefect","Airbyte","ClickHouse","Data Lake",
    "Metabase","Stitch Data","Supermetrics","SQL Server Integration Services","Kibana","Splunk","Domo",
    # Databases / warehouses
    "PostgreSQL","MySQL","MongoDB","Microsoft SQL Server","Snowflake","BigQuery","Supabase","Firebase",
    "MariaDB","Amazon RDS","Amazon Aurora","Amazon Redshift","Amazon DynamoDB","Vector Database","Pinecone",
    "NoSQL Database","Oracle Database","Microsoft Access","Oracle NetSuite","Microsoft Azure SQL Database",
    "Cosmos DB","Vertica","Neo4j","Microsoft Fabric","Fabric",
    # Cloud / devops
    "Amazon Web Services","AWS Lambda","AWS Amplify","AWS Glue","AWS CloudFormation","AWS Fargate","Amazon EC2",
    "Amazon S3","Amazon Athena","Amazon ECS","Microsoft Azure","Google Cloud Platform","Docker","Kubernetes",
    "Terraform","Jenkins","Vercel","NGINX","Git","GitHub","GitLab","Linux","Databricks MLflow",
    # BI / analytics tools
    "Microsoft Power BI","Tableau","Looker","Looker Studio","Metabase","Sisense","Amazon QuickSight","Qlik Sense",
    "QlikView","Power Query","Google Analytics","Google Analytics 4","Google Analytics API","Google Tag Manager",
    "Mixpanel","Amplitude","Adobe Analytics","IBM SPSS","Microsoft Excel","Google Sheets","Microsoft Power Automate",
    "Microsoft PowerApps","Data Analysis Expressions","Microsoft Power BI Data Visualization",
    "Microsoft Power BI Development","Microsoft Excel PowerPivot","Microsoft Power BI Service",
    # AI / LLM tools & platforms
    "OpenAI API","ChatGPT","GPT-4","Claude","Gemini","LangChain","LlamaIndex","n8n","Make.com","Zapier",
    "OpenAI Codex",
    # SaaS / CMS / commerce / CRM platforms
    "Shopify","WordPress","Wix","Squarespace","BigCommerce","Airtable","Stripe","Stripe API","PayPal","Twilio",
    "HubSpot","Salesforce","Salesforce CRM","Zoho CRM","Zoho Analytics","Marketo","ActiveCampaign","Odoo",
    "Microsoft Dynamics 365","Microsoft Dynamics CRM","Microsoft Dynamics ERP","Google Ads","Google Search Console",
    "Google Apps Script","Facebook Ads Manager","Meta Pixel","Google Merchant Center","Kajabi","Supermetrics",
    "Microsoft SharePoint","Office 365","Microsoft Teams","Microsoft 365 Copilot","Customer.io","Pipedrive",
    "Google Cloud","Microsoft Azure SQL Database","Databricks Platform","Snowflake","Apache Spark",
    # Design / 3D / GIS
    "Figma","Photoshop","Adobe Illustrator","Blender","Autodesk Maya","Unreal Engine","Autodesk AutoCAD",
    "Autodesk Fusion 360","SolidWorks","KeyShot","Microsoft PowerPoint","Microsoft Word","ArcGIS","QGIS","GIS",
    # misc named tech
    "GraphQL","REST API","RESTful API","API","Apache Spark MLlib","COMSOL Multiphysics","ANSYS","MATLAB","Simulink",
]))

def classify(n):
    return "tool" if n in TOOLS else "skill"

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
    # drop placeholder labels
    skills_raw = [s for s in skills_raw if s and not s.lower().startswith("+") and "not shown" not in s.lower()]
    tools, skills = {}, {}
    for raw in skills_raw:
        n = norm(raw)
        if not n:
            continue
        (tools if classify(n) == "tool" else skills).setdefault(n, raw)
    return {
        "name": field("name"), "title": field("title"), "hourly_rate": field("hourly_rate"),
        "url": field("url"), "matched_keyword": field("matched_keyword"),
        "location": field("location"), "tools": tools, "skills": skills,
    }

def signals(base, coll):
    bk, ck = set(base), set(coll)
    base_only = sorted(base[k] for k in (bk - ck))
    coll_only = sorted(coll[k] for k in (ck - bk))
    shared = sorted(base[k] for k in (bk & ck))
    total = len(bk | ck)
    ratio = (len(bk & ck) / total) if total else 0.0
    return {"base_only": base_only, "coll_only": coll_only, "shared": shared,
            "n_base_only": len(base_only), "n_coll_only": len(coll_only), "n_shared": len(shared),
            "overlap_ratio": round(ratio, 3), "total_distinct": total}

base_path = os.path.join(BYSKILL, BASELINE_FILE)
base = parse_profile(base_path)

others = sorted(p for p in glob.glob(os.path.join(BYSKILL, "*.md"))
                if os.path.basename(p) not in (BASELINE_FILE, "failed.md")
                and not os.path.basename(p).startswith("_"))

agg = {k: collections.Counter() for k in
       ["tools_shared","tools_base_only","tools_coll_only","skills_shared","skills_base_only","skills_coll_only"]}
comparisons = []
for op in others:
    c = parse_profile(op)
    tsig = signals(base["tools"], c["tools"])
    ssig = signals(base["skills"], c["skills"])
    for l in tsig["shared"]: agg["tools_shared"][l]+=1
    for l in tsig["base_only"]: agg["tools_base_only"][l]+=1
    for l in tsig["coll_only"]: agg["tools_coll_only"][l]+=1
    for l in ssig["shared"]: agg["skills_shared"][l]+=1
    for l in ssig["base_only"]: agg["skills_base_only"][l]+=1
    for l in ssig["coll_only"]: agg["skills_coll_only"][l]+=1
    comparisons.append({"file": os.path.basename(op), "name": c["name"], "title": c["title"],
                        "hourly_rate": c["hourly_rate"], "url": c["url"],
                        "matched_keyword": c["matched_keyword"], "location": c["location"],
                        "tools": tsig, "skills": ssig})

out = {
    "baseline": {
        "name": base["name"], "title": base["title"], "hourly_rate": base["hourly_rate"],
        "url": base["url"], "location": base["location"],
        "tools": sorted(base["tools"].values()), "skills": sorted(base["skills"].values()),
        "n_tools": len(base["tools"]), "n_skills": len(base["skills"]),
    },
    "n_collected": len(others),
    "comparisons": comparisons,
    "rollup": {k: v.most_common(25) for k, v in agg.items()},
    "avg_tool_overlap": round(sum(c["tools"]["overlap_ratio"] for c in comparisons)/len(comparisons), 3),
    "avg_skill_overlap": round(sum(c["skills"]["overlap_ratio"] for c in comparisons)/len(comparisons), 3),
}
with open(os.path.join(HERE, "faizan_analysis_data.json"), "w") as f:
    json.dump(out, f, indent=1)

print("baseline tools:", out["baseline"]["tools"])
print("baseline skills:", out["baseline"]["skills"])
print("collected:", out["n_collected"])
print("avg tool overlap:", out["avg_tool_overlap"], " avg skill overlap:", out["avg_skill_overlap"])
print("top collected-only TOOLS (gaps):", agg["tools_coll_only"].most_common(12))
print("top collected-only SKILLS (gaps):", agg["skills_coll_only"].most_common(12))
print("wrote faizan_analysis_data.json")
