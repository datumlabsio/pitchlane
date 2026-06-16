import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

const createAccountSchema = z.object({
  personName: z.string().min(1).max(100),
  gmailLabel: z.string().min(1).max(200),
  forwardingInbox: z.string().email(),
  notificationEmail: z.string().email().optional().or(z.literal('')),
  roleFocus: z.string().min(1).max(500).default('General freelancing'),
  targetKeywords: z.array(z.string()).optional().default([]),
  requiredSkills: z.array(z.string()).optional().default([]),
  rejectRules: z.array(z.string()).optional().default([]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = createAccountSchema.parse(json);

    const name = payload.personName.toLowerCase().replace(/\s+/g, '-');

    const existing = await prisma.account.findUnique({
      where: { gmailLabel: payload.gmailLabel },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: `Gmail label "${payload.gmailLabel}" is already in use.` },
        { status: 409 },
      );
    }

    const account = await prisma.account.create({
      data: {
        name,
        personName: payload.personName,
        gmailLabel: payload.gmailLabel,
        forwardingInbox: payload.forwardingInbox,
        notificationEmail: payload.notificationEmail || null,
        isActive: true,
        profileConfigs: {
          create: {
            name: `${name}-v1`,
            roleFocus: payload.roleFocus,
            jdSummary: '',
            targetRoles: [],
            targetKeywords: payload.targetKeywords,
            requiredSkills: payload.requiredSkills,
            niceToHaveSkills: [],
            rejectRules: payload.rejectRules,
            proposalRules: [],
            reusableSnippets: [],
            scoringWeights: {
              skillMatch: 0.35,
              roleFit: 0.25,
              keywordMatch: 0.2,
              budgetFit: 0.1,
              confidence: 0.1,
            },
          },
        },
      },
      include: { profileConfigs: true },
    });

    return NextResponse.json({ ok: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
