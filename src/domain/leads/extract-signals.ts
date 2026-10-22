import { SourceCompleteness } from '@prisma/client';

// Cheap regex pass over an alert email — pulls the job URL, budget hint, and known
// skills so a lead is usable before (and without) full enrichment. Shared by every
// email ingestion path (Gmail sync, inbound webhook).
export function extractLeadSignals(subject: string, body: string) {
  const combined = `${subject}\n${body}`;
  const sourceUrlMatch = combined.match(/https?:\/\/www\.upwork\.com\/jobs\/[^\s)]+/i)
    || combined.match(/https?:\/\/www\.upwork\.com\/[^\s)]+/i);

  const budgetMatch = combined.match(/(?:\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:fixed|hour|hr))?)/i)
    || combined.match(/(?:budget|rate)[:\s]+([^\n.]+)/i);

  const knownSkills = [
    'power bi', 'sql', 'dashboard', 'analytics', 'aws', 'python', 'automation', 'terraform',
    'snowflake', 'looker', 'etl', 'excel', 'reporting', 'bigquery', 'dbt', 'docker', 'ci/cd',
  ];

  const lower = combined.toLowerCase();
  const skills = knownSkills.filter((skill) => lower.includes(skill)).slice(0, 8);
  const sourceCompleteness = body.length > 900 ? SourceCompleteness.FULL : SourceCompleteness.PARTIAL;

  return {
    sourceUrl: sourceUrlMatch?.[0],
    budget: budgetMatch?.[0]?.trim(),
    skills,
    sourceCompleteness,
  };
}
