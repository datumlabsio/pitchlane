/**
 * Run with:  npx tsx scripts/seed-profiles.ts
 *
 * Creates all 6 Upwork profiles in the DB. Safe to re-run — skips existing
 * accounts by gmailLabel. Faizan and Humayun are fully populated from their
 * instruction docs. The other 4 have correct Gmail labels + placeholder
 * qualification data — update them via the Profiles UI.
 */

import { PrismaClient, ProposalTone } from '@prisma/client';

const prisma = new PrismaClient();

const FORWARDING_INBOX = 'humayun.jawad@datumlabs.io';
const NOTIFICATION_EMAIL = 'humayun.jawad@datumlabs.io';

const DEFAULT_WEIGHTS = {
  skillMatch: 0.35,
  roleFit: 0.25,
  keywordMatch: 0.2,
  budgetFit: 0.1,
  confidence: 0.1,
};

const profiles = [
  // ─── Faizan Khan ─── full data from instruction PDF
  {
    personName: 'Faizan Khan',
    gmailLabel: 'upwork-alerts-faizan',
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

  // ─── Humayun Jawad ─── full data from Upwork content doc
  {
    personName: 'Humayun Jawad',
    gmailLabel: 'upwork-alerts-humayun',
    roleFocus: 'SaaS Development & Full Stack Engineering',
    jdSummary: `Full-stack SaaS developer specialising in Next.js, React, Node.js, PostgreSQL, and Supabase. Builds complete production-ready systems: SaaS applications, admin panels, internal tools, data dashboards, customer portals, CRM-style tools, and AI automation features. Works with SaaS companies, fintech, e-commerce, healthcare, real estate, and AI startups.`,
    targetRoles: ['Full Stack Developer', 'SaaS Developer', 'Web Application Developer', 'Next.js Developer'],
    targetKeywords: ['Next.js', 'React', 'SaaS', 'dashboard', 'internal tools', 'admin panel', 'Node.js', 'PostgreSQL', 'Supabase', 'TypeScript', 'full stack', 'AI automation', 'OpenAI', 'REST API'],
    requiredSkills: ['Next.js', 'React', 'Node.js', 'PostgreSQL', 'TypeScript'],
    niceToHaveSkills: ['Supabase', 'OpenAI API', 'Stripe', 'Tailwind CSS', 'authentication'],
    rejectRules: ['entry level', 'no budget', 'design only', 'mobile app', 'React Native', 'Flutter', 'WordPress', 'PHP', 'no description'],
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

  // ─── Hadiqa ─── placeholder — update qualification fields via Profiles UI
  {
    personName: 'Hadiqa',
    gmailLabel: 'upwork-alerts-hadiqa',
    roleFocus: 'To be configured — open profile and fill qualification fields',
    jdSummary: '',
    targetRoles: [],
    targetKeywords: [],
    requiredSkills: [],
    niceToHaveSkills: [],
    rejectRules: ['entry level', 'no budget'],
    proposalTone: ProposalTone.CONSULTATIVE,
    proposalRules: [],
    scoreThreshold: 75,
  },

  // ─── Haris ─── placeholder
  {
    personName: 'Haris',
    gmailLabel: 'upwork-alerts-haris',
    roleFocus: 'To be configured — open profile and fill qualification fields',
    jdSummary: '',
    targetRoles: [],
    targetKeywords: [],
    requiredSkills: [],
    niceToHaveSkills: [],
    rejectRules: ['entry level', 'no budget'],
    proposalTone: ProposalTone.CONSULTATIVE,
    proposalRules: [],
    scoreThreshold: 75,
  },

  // ─── Nidal ─── placeholder
  {
    personName: 'Nidal',
    gmailLabel: 'upwork-alerts-nidal',
    roleFocus: 'To be configured — open profile and fill qualification fields',
    jdSummary: '',
    targetRoles: [],
    targetKeywords: [],
    requiredSkills: [],
    niceToHaveSkills: [],
    rejectRules: ['entry level', 'no budget'],
    proposalTone: ProposalTone.CONSULTATIVE,
    proposalRules: [],
    scoreThreshold: 75,
  },

  // ─── Abdur Rehman ─── placeholder
  {
    personName: 'Abdur Rehman',
    gmailLabel: 'upwork-alerts-abdur-rehman',
    roleFocus: 'To be configured — open profile and fill qualification fields',
    jdSummary: '',
    targetRoles: [],
    targetKeywords: [],
    requiredSkills: [],
    niceToHaveSkills: [],
    rejectRules: ['entry level', 'no budget'],
    proposalTone: ProposalTone.CONSULTATIVE,
    proposalRules: [],
    scoreThreshold: 75,
  },
];

async function main() {
  console.log('Seeding profiles...\n');

  for (const p of profiles) {
    const existing = await prisma.account.findUnique({ where: { gmailLabel: p.gmailLabel } });
    if (existing) {
      console.log(`⟳  Skipping ${p.personName} — label "${p.gmailLabel}" already exists`);
      continue;
    }

    const name = p.personName.toLowerCase().replace(/\s+/g, '-');
    await prisma.account.create({
      data: {
        name,
        personName: p.personName,
        gmailLabel: p.gmailLabel,
        forwardingInbox: FORWARDING_INBOX,
        notificationEmail: NOTIFICATION_EMAIL,
        isActive: true,
        profileConfigs: {
          create: {
            name: `${name}-v1`,
            roleFocus: p.roleFocus,
            jdSummary: p.jdSummary,
            targetRoles: p.targetRoles,
            targetKeywords: p.targetKeywords,
            requiredSkills: p.requiredSkills,
            niceToHaveSkills: p.niceToHaveSkills,
            rejectRules: p.rejectRules,
            proposalRules: p.proposalRules,
            reusableSnippets: [],
            scoringWeights: DEFAULT_WEIGHTS,
            scoreThreshold: p.scoreThreshold,
            proposalTone: p.proposalTone,
          },
        },
      },
    });

    console.log(`✓  Created ${p.personName} (${p.gmailLabel})`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
