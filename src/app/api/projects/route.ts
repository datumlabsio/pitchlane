import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createProject } from '@/domain/projects/repository';

const createSchema = z.object({
  accountId: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(160),
  description: z.string().trim().min(1, 'Description is required').max(4000),
  techStack: z.array(z.string().trim().min(1)).max(30).default([]),
  url: z.string().trim().url('Link must be a valid URL').max(500).optional().or(z.literal('')),
  outcome: z.string().trim().max(300).optional(),
  industry: z.string().trim().max(120).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = createSchema.parse(await request.json());
    const project = await createProject(payload.accountId, {
      title: payload.title,
      description: payload.description,
      techStack: payload.techStack,
      url: payload.url || null,
      outcome: payload.outcome || null,
      industry: payload.industry || null,
    });
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? 'Invalid project'
        : error instanceof Error
          ? error.message
          : 'Unable to create project';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
