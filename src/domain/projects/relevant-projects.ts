import type { Project } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { hasTerm, normalize } from '@/domain/leads/evaluate-email';

/**
 * Rank a profile's portfolio projects by relevance to a job's text, so the proposal
 * writer can cite the most on-point evidence. Deterministic and free: tech-stack
 * term overlap (weight 2 — the strongest signal) + industry match (weight 1).
 * Projects with zero overlap are dropped — an irrelevant "proof" project reads
 * worse in a proposal than none at all.
 */
export function rankProjects<T extends Pick<Project, 'techStack' | 'industry'>>(
  projects: T[],
  jobText: string,
  limit = 3,
): T[] {
  const normText = normalize(jobText);
  return projects
    .map((project) => {
      const stackHits = project.techStack.filter((t) => hasTerm(normText, t)).length;
      const industryHit = project.industry && hasTerm(normText, project.industry) ? 1 : 0;
      return { project, score: stackHits * 2 + industryHit };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.project);
}

/** Fetch a profile's active projects and pick the most relevant for this job. */
export async function relevantProjectsForJob(accountId: string, jobText: string, limit = 3): Promise<Project[]> {
  const projects = await prisma.project.findMany({
    where: { accountId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  return rankProjects(projects, jobText, limit);
}

/**
 * Append the selected projects to the freelancer summary that grounds proposal
 * generation. Lives inside the "ABOUT THE FREELANCER (ground every claim in this —
 * never invent experience beyond it)" block, so the writer may cite these projects
 * and links but can't fabricate beyond them.
 */
export function appendProjectsToSummary(
  summary: string,
  projects: Pick<Project, 'title' | 'description' | 'techStack' | 'url' | 'outcome'>[],
): string {
  if (projects.length === 0) return summary;
  const lines = projects.map((p) => {
    const parts = [`- ${p.title}: ${p.description.trim()}`];
    if (p.techStack.length) parts.push(`Stack: ${p.techStack.join(', ')}.`);
    if (p.outcome?.trim()) parts.push(`Outcome: ${p.outcome.trim()}.`);
    if (p.url?.trim()) parts.push(`Link: ${p.url.trim()}`);
    return parts.join(' ');
  });
  return [
    summary.trim(),
    '',
    'RELEVANT PAST PROJECTS (real delivered work). Reference one or two ONLY where they genuinely strengthen the pitch, weaving them in naturally. Cite links exactly as written. Never invent projects, results, or URLs beyond these:',
    ...lines,
  ].join('\n');
}
