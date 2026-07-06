import type { Project } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import type { ProjectInput, ProjectView } from './types';

function mapProject(p: Project): ProjectView {
  return {
    id: p.id,
    accountId: p.accountId,
    title: p.title,
    description: p.description,
    techStack: p.techStack,
    url: p.url,
    outcome: p.outcome,
    industry: p.industry,
    isActive: p.isActive,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listProjectsByAccount(): Promise<Record<string, ProjectView[]>> {
  const projects = await prisma.project.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  const grouped: Record<string, ProjectView[]> = {};
  for (const p of projects) {
    (grouped[p.accountId] ??= []).push(mapProject(p));
  }
  return grouped;
}

export async function createProject(accountId: string, input: ProjectInput): Promise<ProjectView> {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!account) throw new Error('Profile not found.');
  const project = await prisma.project.create({
    data: {
      accountId,
      title: input.title,
      description: input.description,
      techStack: input.techStack,
      url: input.url || null,
      outcome: input.outcome || null,
      industry: input.industry || null,
      isActive: input.isActive ?? true,
    },
  });
  return mapProject(project);
}

export async function updateProject(projectId: string, input: Partial<ProjectInput>): Promise<ProjectView> {
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.techStack !== undefined && { techStack: input.techStack }),
      ...(input.url !== undefined && { url: input.url || null }),
      ...(input.outcome !== undefined && { outcome: input.outcome || null }),
      ...(input.industry !== undefined && { industry: input.industry || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
  return mapProject(project);
}

export async function deleteProject(projectId: string): Promise<void> {
  await prisma.project.delete({ where: { id: projectId } });
}

/** Duplicate a project onto another profile so its description can be re-tailored
 *  to that persona (same delivered work, different framing). */
export async function copyProjectToAccount(projectId: string, targetAccountId: string): Promise<ProjectView> {
  const [source, target] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.account.findUnique({ where: { id: targetAccountId }, select: { id: true } }),
  ]);
  if (!source) throw new Error('Project not found.');
  if (!target) throw new Error('Target profile not found.');
  const copy = await prisma.project.create({
    data: {
      accountId: targetAccountId,
      title: source.title,
      description: source.description,
      techStack: source.techStack,
      url: source.url,
      outcome: source.outcome,
      industry: source.industry,
      isActive: source.isActive,
    },
  });
  return mapProject(copy);
}
