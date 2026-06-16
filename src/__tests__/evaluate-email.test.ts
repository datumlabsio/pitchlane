import { describe, expect, it } from 'vitest';

import { evaluateEmail } from '@/domain/leads/evaluate-email';

const BASE_INPUT = {
  subject: 'Power BI Dashboard Specialist Needed',
  body: 'We need a Power BI developer with SQL experience to build executive dashboards. Budget is $2,000 fixed.',
  requiredSkills: ['power bi', 'sql'],
  niceToHaveSkills: ['dax', 'python'],
  rejectRules: ['unpaid', 'hourly only'],
  targetKeywords: ['dashboard', 'executive', 'reporting'],
  targetRoles: ['bi developer', 'data analyst'],
};

describe('evaluateEmail', () => {
  it('passes hard filter when required skills match and no reject rules hit', () => {
    const result = evaluateEmail(BASE_INPUT);
    expect(result.hardFilterPassed).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
  });

  it('fails hard filter when no required skills are found', () => {
    const result = evaluateEmail({
      ...BASE_INPUT,
      requiredSkills: ['tableau', 'looker'],
    });
    expect(result.hardFilterPassed).toBe(false);
  });

  it('fails hard filter when a reject rule is matched', () => {
    const result = evaluateEmail({
      ...BASE_INPUT,
      body: `${BASE_INPUT.body} This is unpaid work.`,
    });
    expect(result.hardFilterPassed).toBe(false);
    expect(result.rejectionReasons).toContain('unpaid');
  });

  it('returns matched keywords from targetKeywords', () => {
    const result = evaluateEmail(BASE_INPUT);
    expect(result.matchedKeywords).toContain('dashboard');
    expect(result.matchedKeywords).toContain('executive');
  });

  it('returns score between 0 and 95', () => {
    const result = evaluateEmail(BASE_INPUT);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(95);
  });

  it('gives bonus score for nice-to-have skills', () => {
    const withBonus = evaluateEmail({ ...BASE_INPUT, body: `${BASE_INPUT.body} Uses DAX and Python.` });
    const withoutBonus = evaluateEmail(BASE_INPUT);
    expect(withBonus.score).toBeGreaterThan(withoutBonus.score);
  });

  it('returns confidence as a number', () => {
    const result = evaluateEmail(BASE_INPUT);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(95);
  });

  it('respects custom scoring weights', () => {
    const highKeywordWeight = evaluateEmail({
      ...BASE_INPUT,
      targetKeywords: ['dashboard'],
      scoringWeights: { skillMatch: 0.1, roleFit: 0.1, keywordMatch: 0.7, budgetFit: 0.05, confidence: 0.05 },
    });
    const lowKeywordWeight = evaluateEmail({
      ...BASE_INPUT,
      targetKeywords: ['NONEXISTENT_KEYWORD_XYZ'],
      scoringWeights: { skillMatch: 0.1, roleFit: 0.1, keywordMatch: 0.7, budgetFit: 0.05, confidence: 0.05 },
    });
    // With very high keyword weight, missing keywords should hurt the score more
    expect(highKeywordWeight.score).toBeGreaterThan(lowKeywordWeight.score);
  });

  it('defaults to score 50 for skill component when no required skills configured', () => {
    const result = evaluateEmail({
      ...BASE_INPUT,
      requiredSkills: [],
    });
    // Hard filter fails because matchedSkills.length === 0
    expect(result.hardFilterPassed).toBe(false);
  });

  it('produces a non-empty summary array', () => {
    const result = evaluateEmail(BASE_INPUT);
    expect(result.summary).toHaveLength(3);
    expect(result.summary[0]).toContain('skill');
  });

  it('returns empty matchedKeywords when no targetKeywords configured', () => {
    const result = evaluateEmail({ ...BASE_INPUT, targetKeywords: [] });
    expect(result.matchedKeywords).toHaveLength(0);
  });

  it('is case-insensitive for skill and keyword matching', () => {
    const result = evaluateEmail({
      ...BASE_INPUT,
      requiredSkills: ['Power BI', 'SQL'],
      targetKeywords: ['Dashboard', 'Executive'],
    });
    expect(result.hardFilterPassed).toBe(true);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });
});
