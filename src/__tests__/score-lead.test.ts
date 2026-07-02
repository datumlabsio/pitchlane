import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scoreLead } from '@/domain/leads/score-lead';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import type { ProfileConfig } from '@prisma/client';

// Minimal config — only the fields the rule scorer / brief builder read.
const CONFIG = {
  requiredSkills: ['react', 'node.js'],
  niceToHaveSkills: ['typescript'],
  rejectRules: ['wordpress'],
  targetKeywords: ['saas', 'dashboard'],
  targetRoles: ['full stack developer'],
  budgetPreference: null,
  scoringWeights: null,
} as unknown as ProfileConfig;

describe('scoreLead — rules mode (fallback safety net)', () => {
  const prev = process.env.SCORING_MODE;
  beforeAll(() => {
    process.env.SCORING_MODE = 'rules';
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.SCORING_MODE;
    else process.env.SCORING_MODE = prev;
  });

  it('returns exactly what the rule scorer returns', async () => {
    const input = { subject: 'Full stack SaaS', body: 'Build a SaaS dashboard with React and Node.js.' };
    const viaScore = await scoreLead(CONFIG, input);
    const viaRule = evaluateEmail({
      subject: input.subject,
      body: input.body,
      requiredSkills: CONFIG.requiredSkills,
      niceToHaveSkills: CONFIG.niceToHaveSkills,
      rejectRules: CONFIG.rejectRules,
      targetKeywords: CONFIG.targetKeywords,
      targetRoles: CONFIG.targetRoles,
      budgetPreference: undefined,
      scoringWeights: null,
    });
    expect(viaScore).toEqual(viaRule);
  });
});
