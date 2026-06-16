/**
 * Run with:  npx tsx scripts/update-profiles.ts
 * Updates profileConfig for existing accounts with real qualification data.
 */

import { PrismaClient, ProposalTone } from '@prisma/client';

const prisma = new PrismaClient();

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
  'upwork-alerts-faizan': {
    roleFocus: 'Analytics Engineering & Data Consulting',
    jdSummary: `Analytics Engineer with 11,000+ hours logged and 80+ projects on Upwork (Top Rated Plus, 100% JSS). Specialises in dbt on Snowflake/BigQuery, end-to-end ETL/ELT pipelines, and BI systems in Power BI, Tableau, and Looker Studio. Clients include SaaS startups, fintechs, retail operators, real estate firms, and global research organisations.`,
    targetRoles: ['Analytics Engineer', 'Data Engineer', 'BI Developer', 'Data Consultant'],
    targetKeywords: ['dbt', 'Snowflake', 'BigQuery', 'Power BI', 'ETL', 'data modeling', 'analytics engineering', 'dashboard', 'data pipeline', 'Looker Studio', 'Apache Airflow', 'data warehouse'],
    requiredSkills: ['dbt', 'SQL', 'Power BI', 'data modeling'],
    niceToHaveSkills: ['Apache Airflow', 'Tableau', 'Apache Spark', 'Google Analytics 4', 'Python'],
    rejectRules: ['entry level', 'no budget', 'design only', 'mobile development', 'WordPress', 'content writing', 'logo design'],
    proposalTone: ProposalTone.DIRECT,
    proposalRules: [
      'Never start with greetings like Hi / Hello / I am — start with a strong insight or problem statement',
      'Extract 5–8 key technical/business keywords from the job post and mirror them naturally in the proposal',
      'Keep tone: Senior-level consultant — Confident, direct, solution-focused. No fluff, no begging.',
      'Keep length: 150–200 words max',
      'Focus on: Problem understanding, Technical approach (dbt, warehouse, BI, pipelines), Business impact (accuracy, trust, speed, scalability)',
      'Do NOT invent experience outside the given profile',
      'Structure: Hook → Problem understanding → Solution approach → Relevant experience → Keywords → Closing question + CTA',
    ],
    scoreThreshold: 75,
  },

  'upwork-alerts-humayun': {
    roleFocus: 'SaaS Development & Full Stack Engineering',
    jdSummary: `Full-stack SaaS developer specialising in Next.js, React, Node.js, PostgreSQL, and Supabase. Builds complete production-ready systems: SaaS applications, admin panels, internal tools, data dashboards, customer portals, CRM-style tools, and AI automation features. Works with SaaS companies, fintech, e-commerce, healthcare, real estate, and AI startups.`,
    targetRoles: ['Full Stack Developer', 'SaaS Developer', 'Web Application Developer', 'Next.js Developer'],
    targetKeywords: ['Next.js', 'React', 'SaaS', 'dashboard', 'internal tools', 'admin panel', 'Node.js', 'PostgreSQL', 'Supabase', 'TypeScript', 'full stack', 'AI automation', 'OpenAI', 'REST API'],
    requiredSkills: ['Next.js', 'React', 'Node.js', 'PostgreSQL', 'TypeScript'],
    niceToHaveSkills: ['Supabase', 'OpenAI API', 'Stripe', 'Tailwind CSS', 'authentication'],
    rejectRules: ['entry level', 'no budget', 'design only', 'mobile app', 'React Native', 'Flutter', 'WordPress', 'PHP'],
    proposalTone: ProposalTone.DIRECT,
    proposalRules: [
      'Never start with greetings — open with the business problem or a direct statement of what you will build',
      'Mirror the client\'s stack and use-case language from the job post',
      'Keep tone: Senior full-stack developer — confident, concise, solution-focused',
      'Keep length: 150–200 words max',
      'Highlight end-to-end delivery: architecture, backend, frontend, deployment',
      'Do NOT invent experience outside the given profile',
    ],
    scoreThreshold: 75,
  },
};

async function main() {
  console.log('Updating profile configs...\n');

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
