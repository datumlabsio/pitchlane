/**
 * Run with:  npx tsx scripts/update-profiles-2.ts
 * Updates profileConfig for Hadiqa, Haris, Nidal, Abdur Rehman using their instruction PDFs.
 */

import { PrismaClient, ProposalTone } from '@prisma/client';

const prisma = new PrismaClient();

const SHARED_PROPOSAL_RULES = [
  'Never start with greetings like Hi / Hello / I am — start with a strong insight or problem statement',
  'Extract 5–8 key technical/business keywords from the job post and mirror them naturally in the proposal',
  'Keep tone: Senior-level consultant — Confident, direct, solution-focused. No fluff, no begging.',
  'Keep length: 150–200 words max',
  'Focus on: Problem understanding, Technical approach, Business impact (accuracy, trust, speed, scalability)',
  'Do NOT invent experience outside the given profile',
  'Structure: Hook → Problem understanding → Solution approach → Relevant experience → Keywords → Closing question + CTA',
];

const updates: Record<string, {
  roleFocus: string;
  jdSummary: string;
  targetRoles: string[];
  targetKeywords: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  rejectRules: string[];
  proposalTone: ProposalTone;
  proposalRules: string[];
  scoreThreshold: number;
}> = {

  'upwork-alerts-abdur-rehman': {
    roleFocus: 'AI Engineering & Agent Development',
    jdSummary: `AI Engineer and AI Agent Developer with 6+ years building production-grade AI systems, LLM-powered applications, and intelligent automation for real-world business use cases. Specialises in multi-agent architectures, RAG pipelines, FastAPI backend AI infrastructure, and workflow automation using LangChain, n8n, OpenAI, and Claude APIs. Focused on production-ready systems — not demos.`,
    targetRoles: ['AI Engineer', 'AI Agent Developer', 'LLM Engineer', 'Backend AI Developer', 'Automation Engineer'],
    targetKeywords: [
      'AI agent', 'LLM', 'RAG', 'multi-agent', 'LangChain', 'FastAPI', 'Python',
      'OpenAI', 'Claude', 'automation', 'vector database', 'n8n', 'chatbot',
      'AI pipeline', 'Retrieval Augmented Generation', 'workflow automation',
    ],
    requiredSkills: ['Python', 'LLM integration', 'AI agents', 'FastAPI'],
    niceToHaveSkills: ['LangChain', 'n8n', 'Zapier', 'Make.com', 'Qdrant', 'RAG', 'SQL', 'ETL'],
    rejectRules: [
      'frontend only', 'mobile development', 'React Native', 'Flutter',
      'WordPress', 'no AI component', 'entry level', 'data engineering only',
    ],
    proposalTone: ProposalTone.EXPERT,
    proposalRules: SHARED_PROPOSAL_RULES,
    scoreThreshold: 75,
  },

  'upwork-alerts-nidal': {
    roleFocus: 'Data Engineering & Pipeline Development',
    jdSummary: `Senior Data Engineer with 1,700+ hours on Upwork (100% JSS) building production ETL/ELT pipelines, cloud data warehouses, and analytics platforms. Specialises in Airflow orchestration, dbt transformation, and Snowflake/BigQuery warehousing across AWS, GCP, and Azure. Projects span real-time FinTech analytics (ClickHouse + Power BI), smart real estate stacks (Airflow + dbt + Snowflake), and legacy-to-modern pipeline migrations (Airbyte → dbt → BigQuery → Looker Studio).`,
    targetRoles: ['Data Engineer', 'ETL Developer', 'Data Platform Engineer', 'Cloud Data Engineer'],
    targetKeywords: [
      'ETL', 'ELT', 'Airflow', 'dbt', 'Snowflake', 'BigQuery', 'data pipeline',
      'data warehouse', 'AWS', 'GCP', 'Kafka', 'CDC', 'data modeling',
      'Databricks', 'Fivetran', 'Airbyte', 'Redshift', 'ClickHouse',
    ],
    requiredSkills: ['Python', 'dbt', 'Apache Airflow', 'cloud data warehouse (Snowflake / BigQuery / Redshift)'],
    niceToHaveSkills: ['Apache Kafka', 'Databricks', 'Kubernetes', 'Docker', 'Fivetran', 'Airbyte', 'Azure Data Factory'],
    rejectRules: [
      'AI/ML only', 'frontend', 'mobile development', 'WordPress',
      'entry level', 'no data engineering', 'content writing',
    ],
    proposalTone: ProposalTone.CONSULTATIVE,
    proposalRules: SHARED_PROPOSAL_RULES,
    scoreThreshold: 75,
  },

  'upwork-alerts-hadiqa': {
    roleFocus: 'BI & Analytics Engineering',
    jdSummary: `BI & Analytics Engineer with 4+ years building modern data infrastructure for SaaS companies, marketplaces, and high-growth startups. Specialises in end-to-end data stack delivery: multi-source ingestion (dlt, Fivetran, Airbyte), dbt transformations with staging/intermediate/mart layers, BigQuery/Snowflake/ClickHouse warehousing, and dashboards in Hex, Metabase, Power BI, and Tableau. dbt Certified Developer. Delivers systems clients fully own — no black-box pipelines.`,
    targetRoles: ['BI Engineer', 'Analytics Engineer', 'Data Analyst', 'Dashboard Developer', 'Data Stack Consultant'],
    targetKeywords: [
      'dbt', 'BigQuery', 'Snowflake', 'dashboard', 'analytics', 'BI',
      'data modeling', 'ETL', 'ELT', 'Hex', 'Metabase', 'Power BI',
      'Tableau', 'Dagster', 'data pipeline', 'Looker Studio', 'ClickHouse',
    ],
    requiredSkills: ['SQL', 'dbt', 'BigQuery or Snowflake', 'BI tool (Hex / Metabase / Looker / Power BI / Tableau)'],
    niceToHaveSkills: ['Python', 'LangChain', 'Dagster', 'Fivetran', 'Airbyte', 'GA4', 'Stripe', 'HubSpot', 'Mixpanel'],
    rejectRules: [
      'backend development only', 'mobile', 'frontend only',
      'no analytics component', 'entry level', 'WordPress', 'content writing',
    ],
    proposalTone: ProposalTone.CONSULTATIVE,
    proposalRules: SHARED_PROPOSAL_RULES,
    scoreThreshold: 75,
  },

  'upwork-alerts-haris': {
    roleFocus: 'Real-time Data Engineering & Streaming Platforms',
    jdSummary: `Real-time Data Engineer specialising in production-grade data platforms for SaaS and fintech where latency, reliability, and scale matter. Builds Kafka-based streaming pipelines, CDC-based ingestion systems, Snowflake/BigQuery/ClickHouse warehouses, and dbt transformation layers with sub-5-second analytics. Recent project: near real-time operational data platform for Sojo Industries integrating Manhattan WMS with Snowflake via Airflow and dbt.`,
    targetRoles: ['Data Engineer', 'Real-time Data Engineer', 'Streaming Data Engineer', 'Data Platform Engineer'],
    targetKeywords: [
      'Kafka', 'real-time', 'streaming', 'CDC', 'Snowflake', 'BigQuery',
      'dbt', 'Airflow', 'ClickHouse', 'ETL', 'data pipeline', 'SaaS',
      'fintech', 'event-driven', 'sub-second latency', 'Dagster', 'Prefect',
    ],
    requiredSkills: ['Python', 'Apache Kafka or streaming', 'Snowflake or BigQuery', 'dbt', 'Apache Airflow or Dagster'],
    niceToHaveSkills: ['ClickHouse', 'Docker', 'AWS', 'GCP', 'Grafana', 'Prometheus', 'Fivetran', 'CDC pipelines'],
    rejectRules: [
      'pure BI only', 'frontend', 'mobile development',
      'entry level', 'WordPress', 'no data engineering component', 'content writing',
    ],
    proposalTone: ProposalTone.DIRECT,
    proposalRules: SHARED_PROPOSAL_RULES,
    scoreThreshold: 75,
  },
};

async function main() {
  console.log('Updating profile configs for remaining 4 profiles...\n');

  for (const [gmailLabel, data] of Object.entries(updates)) {
    const account = await prisma.account.findUnique({
      where: { gmailLabel },
      include: { profileConfigs: { where: { isActive: true }, orderBy: { version: 'desc' }, take: 1 } },
    });

    if (!account) {
      console.log(`✗  Account not found for label: ${gmailLabel}`);
      continue;
    }

    const config = account.profileConfigs[0];
    if (!config) {
      console.log(`✗  No active profile config for: ${account.personName}`);
      continue;
    }

    await prisma.profileConfig.update({
      where: { id: config.id },
      data: {
        roleFocus: data.roleFocus,
        jdSummary: data.jdSummary,
        targetRoles: data.targetRoles,
        targetKeywords: data.targetKeywords,
        requiredSkills: data.requiredSkills,
        niceToHaveSkills: data.niceToHaveSkills,
        rejectRules: data.rejectRules,
        proposalTone: data.proposalTone,
        proposalRules: data.proposalRules,
        scoreThreshold: data.scoreThreshold,
      },
    });

    console.log(`✓  Updated ${account.personName} (${gmailLabel})`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
