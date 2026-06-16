import { LeadSource, LeadStatus, PrismaClient, ProposalTone, SourceCompleteness } from '@prisma/client';

const prisma = new PrismaClient();

const forwardingInbox = process.env.DEFAULT_FORWARDING_INBOX ?? 'humayun.jawad@datumlabs.io';
const notificationEmail = process.env.DEFAULT_NOTIFICATION_EMAIL ?? 'humayun.jawad@datumlabs.io';

const profiles = [
  {
    name: 'Humayun Jawad',
    personName: 'Humayun Jawad',
    upworkProfileUrl: 'https://www.upwork.com/freelancers/~018523a64cbe13cfd9',
    gmailLabel: 'upwork-alerts-humayun',
    roleFocus: 'Data Engineering and BI',
    targetRoles: ['Data Engineer', 'BI Developer', 'Analytics Engineer'],
    targetKeywords: ['power bi', 'sql', 'dashboard', 'analytics', 'reporting'],
    requiredSkills: ['power bi', 'sql', 'dashboard'],
    niceToHaveSkills: ['bigquery', 'snowflake', 'looker'],
    rejectRules: ['telegram', 'whatsapp', 'unpaid', 'free sample'],
    budgetPreference: 'Mid-market analytics and dashboard work',
    scoreThreshold: 78,
    proposalTone: ProposalTone.CONSULTATIVE,
  },
  {
    name: 'Faizan Khan',
    personName: 'Faizan Khan',
    upworkProfileUrl: 'https://www.upwork.com/freelancers/ifaizankhan',
    gmailLabel: 'upwork-alerts-faizan',
    roleFocus: 'Cloud and Backend Automation',
    targetRoles: ['Backend Engineer', 'Cloud Engineer', 'Automation Engineer'],
    targetKeywords: ['aws', 'python', 'automation', 'terraform', 'backend'],
    requiredSkills: ['aws', 'python', 'automation'],
    niceToHaveSkills: ['serverless', 'docker', 'ci/cd'],
    rejectRules: ['telegram', 'unpaid', 'commission only'],
    budgetPreference: 'Automation, infra, and backend modernization work',
    scoreThreshold: 80,
    proposalTone: ProposalTone.EXPERT,
  },
  {
    name: 'Muhammad S',
    personName: 'Muhammad S',
    upworkProfileUrl: 'https://www.upwork.com/freelancers/~01da9c643b996b41e1/',
    gmailLabel: 'upwork-alerts-muhammad-s',
    roleFocus: 'Data Platforms and Reporting',
    targetRoles: ['Data Platform Engineer', 'BI Consultant'],
    targetKeywords: ['snowflake', 'etl', 'warehouse', 'looker', 'reporting'],
    requiredSkills: ['snowflake', 'etl', 'reporting'],
    niceToHaveSkills: ['airbyte', 'dbt', 'analytics engineering'],
    rejectRules: ['whatsapp', 'free trial'],
    budgetPreference: 'Reporting and data platform delivery',
    scoreThreshold: 76,
    proposalTone: ProposalTone.DIRECT,
  },
  {
    name: 'Nidal C',
    personName: 'Nidal C',
    upworkProfileUrl: 'https://www.upwork.com/freelancers/~0165b976ee2f6873c4/',
    gmailLabel: 'upwork-alerts-nidal',
    roleFocus: 'Product Analytics and Data Delivery',
    targetRoles: ['Analytics Consultant', 'BI Lead'],
    targetKeywords: ['analytics', 'kpi', 'dashboard', 'stakeholder', 'sql'],
    requiredSkills: ['analytics', 'dashboard', 'sql'],
    niceToHaveSkills: ['amplitude', 'mixpanel', 'warehouse'],
    rejectRules: ['commission only', 'unpaid'],
    budgetPreference: 'Stakeholder-facing analytics delivery',
    scoreThreshold: 77,
    proposalTone: ProposalTone.CONSULTATIVE,
  },
  {
    name: 'Hadiqa M',
    personName: 'Hadiqa M',
    upworkProfileUrl: 'https://www.upwork.com/freelancers/~0156059ec926e8d916/',
    gmailLabel: 'upwork-alerts-hadiqa',
    roleFocus: 'Operations Analytics and Reporting',
    targetRoles: ['Reporting Specialist', 'Operations Analyst'],
    targetKeywords: ['reporting', 'operations', 'excel', 'dashboard', 'analysis'],
    requiredSkills: ['reporting', 'analysis'],
    niceToHaveSkills: ['power bi', 'google sheets', 'ops metrics'],
    rejectRules: ['telegram', 'free work'],
    budgetPreference: 'Operations and reporting projects',
    scoreThreshold: 72,
    proposalTone: ProposalTone.FRIENDLY,
  },
];

for (const profile of profiles) {
  await prisma.account.upsert({
    where: { gmailLabel: profile.gmailLabel },
    update: {
      name: profile.name,
      personName: profile.personName,
      upworkProfileUrl: profile.upworkProfileUrl,
      forwardingInbox,
      notificationEmail,
      isActive: true,
    },
    create: {
      name: profile.name,
      personName: profile.personName,
      upworkProfileUrl: profile.upworkProfileUrl,
      gmailLabel: profile.gmailLabel,
      forwardingInbox,
      notificationEmail,
      isActive: true,
    },
  });

  const account = await prisma.account.findUniqueOrThrow({ where: { gmailLabel: profile.gmailLabel } });

  await prisma.profileConfig.upsert({
    where: { id: `${account.id}-v1` },
    update: {
      name: `${profile.personName} Default Config`,
      roleFocus: profile.roleFocus,
      jdSummary: `${profile.personName} is positioned for ${profile.roleFocus.toLowerCase()} opportunities sourced through forwarded Upwork alerts.`,
      targetRoles: profile.targetRoles,
      targetKeywords: profile.targetKeywords,
      requiredSkills: profile.requiredSkills,
      niceToHaveSkills: profile.niceToHaveSkills,
      rejectRules: profile.rejectRules,
      budgetPreference: profile.budgetPreference,
      scoreThreshold: profile.scoreThreshold,
      proposalTone: profile.proposalTone,
      proposalRules: [
        'Keep the proposal concise and specific.',
        'Reference the visible requirement from the forwarded email.',
        'Avoid generic claims and filler language.',
      ],
      reusableSnippets: [
        'I focus on delivery clarity, stakeholder visibility, and fast iteration.',
        'I prefer to align the outcome first, then shape the implementation plan around it.',
      ],
      scoringWeights: {
        skillMatch: 0.35,
        roleFit: 0.25,
        keywordMatch: 0.2,
        budgetFit: 0.1,
        confidence: 0.1,
      },
      version: 1,
      isActive: true,
    },
    create: {
      id: `${account.id}-v1`,
      accountId: account.id,
      name: `${profile.personName} Default Config`,
      roleFocus: profile.roleFocus,
      jdSummary: `${profile.personName} is positioned for ${profile.roleFocus.toLowerCase()} opportunities sourced through forwarded Upwork alerts.`,
      targetRoles: profile.targetRoles,
      targetKeywords: profile.targetKeywords,
      requiredSkills: profile.requiredSkills,
      niceToHaveSkills: profile.niceToHaveSkills,
      rejectRules: profile.rejectRules,
      budgetPreference: profile.budgetPreference,
      scoreThreshold: profile.scoreThreshold,
      proposalTone: profile.proposalTone,
      proposalRules: [
        'Keep the proposal concise and specific.',
        'Reference the visible requirement from the forwarded email.',
        'Avoid generic claims and filler language.',
      ],
      reusableSnippets: [
        'I focus on delivery clarity, stakeholder visibility, and fast iteration.',
        'I prefer to align the outcome first, then shape the implementation plan around it.',
      ],
      scoringWeights: {
        skillMatch: 0.35,
        roleFit: 0.25,
        keywordMatch: 0.2,
        budgetFit: 0.1,
        confidence: 0.1,
      },
      version: 1,
      isActive: true,
    },
  });
}

const sampleLeadSpecs = [
  {
    gmailLabel: 'upwork-alerts-humayun',
    title: 'Power BI Dashboard Specialist for Executive Reporting',
    sourceUrl: 'https://www.upwork.com/jobs/~sample-humayun-1',
    emailSubject: 'Power BI Dashboard Specialist for Executive Reporting',
    emailSnippet: 'Looking for a Power BI and SQL specialist to improve recurring executive dashboards and reporting visibility.',
    rawEmailBody: 'Looking for a Power BI and SQL specialist to improve recurring executive dashboards and reporting visibility. The work includes stakeholder reporting, data cleanup, and dashboard redesign.',
    extractedBudget: '$1,200 fixed',
    extractedSkills: ['power bi', 'sql', 'dashboard'],
    confidence: 62,
    status: LeadStatus.QUALIFIED,
    score: 84,
    proposal: 'Hi, this looks aligned with the reporting and dashboard work I handle regularly. I can help tighten the SQL layer, improve stakeholder visibility, and reshape the dashboard flow around clearer decision-making. If useful, I can outline a first-pass implementation approach based on the current reporting stack.',
    rejectionReasons: [],
    matchedKeywords: ['power bi', 'reporting', 'dashboard'],
    summary: ['Strong BI and dashboard match from the forwarded email.', 'Budget looks viable for the profile.', 'Proposal drafted from partial email context.'],
    application: { connectsSpent: 16, appliedAt: new Date(), lastFollowUpAt: null, notes: 'Seeded sample application.' },
  },
  {
    gmailLabel: 'upwork-alerts-faizan',
    title: 'AWS Automation Engineer for Cost Optimization',
    sourceUrl: 'https://www.upwork.com/jobs/~sample-faizan-1',
    emailSubject: 'AWS Automation Engineer for Cost Optimization',
    emailSnippet: 'Need an engineer with AWS, automation, and Python experience to reduce cloud waste and improve deployment consistency.',
    rawEmailBody: 'Need an engineer with AWS, automation, and Python experience to reduce cloud waste and improve deployment consistency. Terraform familiarity is a plus. This is an infrastructure-heavy engagement.',
    extractedBudget: '$45/hr',
    extractedSkills: ['aws', 'python', 'automation'],
    confidence: 58,
    status: LeadStatus.NEW,
    score: 79,
    proposal: 'Hi, this looks close to the cloud automation work I support regularly. The strongest fit from the brief is the combination of AWS cost control, automation, and Python-based operational improvement. I can help define the highest-impact targets first and then translate that into a practical execution plan.',
    rejectionReasons: [],
    matchedKeywords: ['aws', 'automation', 'python'],
    summary: ['Good cloud and automation fit.', 'Forwarded email provides moderate technical clarity.', 'Should be reviewed before applying.'],
    application: null,
  },
  {
    gmailLabel: 'upwork-alerts-nidal',
    title: 'Snowflake and Looker Reporting Lead',
    sourceUrl: 'https://www.upwork.com/jobs/~sample-nidal-1',
    emailSubject: 'Snowflake and Looker Reporting Lead',
    emailSnippet: 'Seeking a consultant to own Snowflake modeling and Looker-based stakeholder reporting for a growing data team.',
    rawEmailBody: 'Seeking a consultant to own Snowflake modeling and Looker-based stakeholder reporting for a growing data team. Need someone comfortable with ETL design and metric definition.',
    extractedBudget: '$3,500 fixed',
    extractedSkills: ['snowflake', 'looker', 'etl'],
    confidence: 78,
    status: LeadStatus.APPLIED,
    score: 88,
    proposal: 'Hi, this is strongly aligned with the data platform and reporting work I take on. The combination of Snowflake ownership, Looker reporting, and ETL design suggests a role where delivery clarity matters as much as technical execution. I can help tighten both the data model and the reporting workflow from the start.',
    rejectionReasons: [],
    matchedKeywords: ['snowflake', 'looker', 'reporting'],
    summary: ['Strong data platform fit.', 'Budget and role scope look healthy.', 'High-confidence proposal draft from partial email.'],
    application: { connectsSpent: 18, appliedAt: new Date(), lastFollowUpAt: new Date(), notes: 'Follow-up sent.' },
  },
];

for (const spec of sampleLeadSpecs) {
  const account = await prisma.account.findUniqueOrThrow({ where: { gmailLabel: spec.gmailLabel } });
  const profileConfig = await prisma.profileConfig.findFirstOrThrow({
    where: { accountId: account.id, isActive: true },
    orderBy: { version: 'desc' },
  });

  const lead = await prisma.lead.upsert({
    where: { dedupeKey: `${spec.gmailLabel}:${spec.title}:${spec.sourceUrl}`.toLowerCase() },
    update: {
      title: spec.title,
      emailSubject: spec.emailSubject,
      emailSnippet: spec.emailSnippet,
      rawEmailBody: spec.rawEmailBody,
      extractedBudget: spec.extractedBudget,
      extractedSkills: spec.extractedSkills,
      confidence: spec.confidence,
      status: spec.status,
      sourceUrl: spec.sourceUrl,
    },
    create: {
      accountId: account.id,
      title: spec.title,
      source: LeadSource.EMAIL_FORWARD,
      sourceUrl: spec.sourceUrl,
      sender: 'alerts@upwork.com',
      emailSubject: spec.emailSubject,
      emailSnippet: spec.emailSnippet,
      rawEmailBody: spec.rawEmailBody,
      extractedBudget: spec.extractedBudget,
      extractedSkills: spec.extractedSkills,
      sourceCompleteness: SourceCompleteness.PARTIAL,
      confidence: spec.confidence,
      dedupeKey: `${spec.gmailLabel}:${spec.title}:${spec.sourceUrl}`.toLowerCase(),
      status: spec.status,
    },
  });

  await prisma.leadEvaluation.upsert({
    where: { id: `${lead.id}-eval` },
    update: {
      profileConfigId: profileConfig.id,
      score: spec.score,
      hardFilterPassed: true,
      rejectionReasons: spec.rejectionReasons,
      matchedKeywords: spec.matchedKeywords,
      summary: spec.summary,
      confidence: spec.confidence,
    },
    create: {
      id: `${lead.id}-eval`,
      leadId: lead.id,
      profileConfigId: profileConfig.id,
      score: spec.score,
      hardFilterPassed: true,
      rejectionReasons: spec.rejectionReasons,
      matchedKeywords: spec.matchedKeywords,
      summary: spec.summary,
      confidence: spec.confidence,
    },
  });

  await prisma.proposalVersion.upsert({
    where: { id: `${lead.id}-proposal` },
    update: {
      profileConfigId: profileConfig.id,
      content: spec.proposal,
      isPrimary: true,
      isAiGenerated: true,
    },
    create: {
      id: `${lead.id}-proposal`,
      leadId: lead.id,
      profileConfigId: profileConfig.id,
      content: spec.proposal,
      isPrimary: true,
      isAiGenerated: true,
    },
  });

  if (spec.application) {
    await prisma.application.upsert({
      where: { id: `${lead.id}-application` },
      update: {
        accountId: account.id,
        leadId: lead.id,
        connectsSpent: spec.application.connectsSpent,
        appliedAt: spec.application.appliedAt,
        lastFollowUpAt: spec.application.lastFollowUpAt,
        notes: spec.application.notes,
      },
      create: {
        id: `${lead.id}-application`,
        accountId: account.id,
        leadId: lead.id,
        connectsSpent: spec.application.connectsSpent,
        appliedAt: spec.application.appliedAt,
        lastFollowUpAt: spec.application.lastFollowUpAt,
        notes: spec.application.notes,
      },
    });
  }
}

console.log(`Seeded ${profiles.length} accounts with default configs and ${sampleLeadSpecs.length} sample leads.`);
await prisma.$disconnect();
