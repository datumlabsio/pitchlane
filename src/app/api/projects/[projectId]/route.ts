import { NextResponse } from 'next/server';
import { z } from 'zod';

import { copyProjectToAccount, deleteProject, updateProject } from '@/domain/projects/repository';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  techStack: z.array(z.string().trim().min(1)).max(30).optional(),
  url: z.string().trim().url('Link must be a valid URL').max(500).optional().or(z.literal('')),
  outcome: z.string().trim().max(300).optional(),
  industry: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
});

const copySchema = z.object({ copyToAccountId: z.string().min(1) });

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const payload = updateSchema.parse(await request.json());
    const project = await updateProject(projectId, payload);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? 'Invalid project'
        : error instanceof Error
          ? error.message
          : 'Unable to update project';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/** Copy this project to another profile (same work, re-tailored per persona). */
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const { copyToAccountId } = copySchema.parse(await request.json());
    const project = await copyProjectToAccount(projectId, copyToAccountId);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to copy project';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    await deleteProject(projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete project';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
