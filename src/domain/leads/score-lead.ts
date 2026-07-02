import type { ProfileConfig } from '@prisma/client';

import type { EvaluationResult } from '@/domain/leads/types';
import { evaluateEmail } from '@/domain/leads/evaluate-email';
import { judgeLead, type JudgeResult } from '@/domain/leads/judge-lead';
import { buildProfileBrief } from '@/domain/leads/profile-brief';

export type ScoreInput = {
  subject: string;
  body: string;
  budget?: string | null;
  clientSummary?: string | null;
};

// Scoring backend: "llm" (Claude judge, default) or "rules" (the keyword scorer).
// Read from process.env directly so it stays independent of the LiteLLM env wiring.
function scoringMode(): 'llm' | 'rules' {
  return process.env.SCORING_MODE === 'rules' ? 'rules' : 'llm';
}

// Map the judge's verdict onto the stored evaluation shape. Only a hard `reject`
// populates rejectionReasons — that drives status AND the Slack suppression gate, so
// a `qualify`/`caution` lead with a budget caution still alerts (the caution lives in
// the summary instead). Only a clear `qualify` passes the hard filter (auto-promote +
// proposal); `caution` stays NEW-but-surfaced for a human look.
function judgeToEvaluation(j: JudgeResult): EvaluationResult {
  const summary = [
    ...j.reasoning,
    ...(j.redFlags.length ? [`⚠ ${j.redFlags.join('; ')}`] : []),
    ...(j.betterFitProfile ? [`↪ Better fit: ${j.betterFitProfile}`] : []),
  ];
  return {
    score: j.fitScore,
    confidence: j.confidence,
    hardFilterPassed: j.verdict === 'qualify',
    rejectionReasons:
      j.verdict === 'reject' ? (j.redFlags.length ? j.redFlags : ['Not a fit for this profile']) : [],
    matchedKeywords: [],
    summary: summary.length ? summary : [`Verdict: ${j.verdict}`],
  };
}

function ruleEvaluation(config: ProfileConfig, input: ScoreInput): EvaluationResult {
  return evaluateEmail({
    subject: input.subject,
    body: input.body,
    requiredSkills: config.requiredSkills,
    niceToHaveSkills: config.niceToHaveSkills,
    rejectRules: config.rejectRules,
    targetKeywords: config.targetKeywords,
    targetRoles: config.targetRoles,
    budgetPreference: config.budgetPreference ?? undefined,
    scoringWeights: config.scoringWeights as {
      skillMatch?: number;
      roleFit?: number;
      keywordMatch?: number;
      budgetFit?: number;
      confidence?: number;
    } | null,
  });
}

/**
 * Score a lead against a profile. Uses the LLM judge when SCORING_MODE=llm (default)
 * and it's available; falls back to the keyword rule scorer otherwise (no API key,
 * judge error, or SCORING_MODE=rules) so scoring never hard-fails.
 */
export async function scoreLead(config: ProfileConfig, input: ScoreInput): Promise<EvaluationResult> {
  if (scoringMode() === 'llm') {
    const judged = await judgeLead({
      brief: buildProfileBrief(config),
      jobTitle: input.subject,
      jobBody: input.body,
      jobBudget: input.budget,
      clientSummary: input.clientSummary,
    });
    if (judged) return judgeToEvaluation(judged);
  }
  return ruleEvaluation(config, input);
}
