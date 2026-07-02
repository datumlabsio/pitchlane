import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';

/**
 * LLM lead judge — reads a job against ONE freelancer's profile brief and decides
 * fit + verdict, instead of counting keyword ratios. This understands context the
 * rule scorer can't: optional-vs-required tech, budget-vs-scope sanity, and whether
 * the work actually belongs to a different specialty. Returns null when unavailable
 * (no provider, error, or refusal) so the caller can fall back to the rule scorer.
 *
 * Provider chain (mirrors the proposal writer): LLM_PROVIDER=litellm routes to the
 * on-prem OpenAI-compatible proxy first, falling back to Anthropic if it's
 * unconfigured/unreachable/errors. Default is Anthropic direct. The LITELLM_ and
 * LLM_PROVIDER vars are read from process.env (not the validated env object) so this
 * file stays deployable independently of the local-only LiteLLM env wiring.
 */
export type JudgeInput = {
  brief: string;
  jobTitle: string;
  jobBody: string;
  jobBudget?: string | null;
  clientSummary?: string | null;
};

export type JudgeResult = {
  fitScore: number; // 0–100
  verdict: 'qualify' | 'caution' | 'reject';
  redFlags: string[];
  betterFitProfile: string; // '' when this freelancer is the right owner
  reasoning: string[];
  confidence: number; // 0–100
};

// High-volume classification call → defaults to Haiku (~½¢/lead). Bump via
// SCORING_MODEL for sharper judgments (e.g. claude-sonnet-4-6 / claude-opus-4-8).
const SCORING_MODEL = process.env.SCORING_MODEL || 'claude-haiku-4-5';

const TOOL_NAME = 'record_assessment';
const TOOL_DESCRIPTION = 'Record the fit assessment of this job for the freelancer.';
const TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    fitScore: {
      type: 'integer',
      description:
        'How well the job matches THIS freelancer (0–100). 70+ strong fit worth applying; 40–69 partial/uncertain; <40 poor fit.',
    },
    verdict: {
      type: 'string',
      enum: ['qualify', 'caution', 'reject'],
      description:
        'qualify = clearly worth applying; caution = worth a human look (partial fit or a concern); reject = not worth their time.',
    },
    redFlags: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Concrete concerns: budget-vs-scope mismatch, vague/underspecified spec, off-limits work, unrealistic timeline. Empty if none.',
    },
    betterFitProfile: {
      type: 'string',
      description:
        'If the work clearly belongs to a different specialty than this freelancer\'s, name it (e.g. "Abdur (LLM/RAG)"). Empty string otherwise.',
    },
    reasoning: {
      type: 'array',
      items: { type: 'string' },
      description: '2–4 terse bullets justifying the verdict.',
    },
    confidence: { type: 'integer', description: 'Your confidence in this assessment (0–100).' },
  },
  required: ['fitScore', 'verdict', 'redFlags', 'betterFitProfile', 'reasoning', 'confidence'],
};

function buildSystem(brief: string): string {
  return [
    'You are a lead-qualification analyst for a freelance agency. Decide how well one specific Upwork job fits ONE freelancer, and whether they should pursue it.',
    '',
    'FREELANCER PROFILE',
    brief.trim(),
    '',
    'Rules:',
    '- Judge on the ACTUAL requirements. A technology listed as optional ("or similar", "nice to have", "open to"), or appearing only in a platform\'s auto skill-tags, is NOT a requirement.',
    '- A strong generalist fits a job that uses only ONE of their stacks — do not require every skill at once.',
    '- Weigh viability, not just skills: a tiny fixed budget for a large multi-month build, or a vague spec, is a real red flag even when the skills match.',
    '- If the work is primarily a specialty this freelancer does NOT do, set betterFitProfile and lower the verdict accordingly.',
    `Call ${TOOL_NAME} with your verdict. Do not write prose outside the tool.`,
  ].join('\n');
}

function buildUser(input: JudgeInput): string {
  const facts: string[] = [];
  if (input.jobBudget) facts.push(`Budget: ${input.jobBudget}`);
  if (input.clientSummary) facts.push(`Client: ${input.clientSummary}`);
  return [
    'JOB',
    `Title: ${input.jobTitle}`,
    ...(facts.length ? ['', ...facts] : []),
    '',
    'Description:',
    input.jobBody?.trim() || '(No description captured — infer intent from the title.)',
  ].join('\n');
}

// Clamp/validate — never trust the model to stay in range or shape.
function normalizeResult(raw: unknown): JudgeResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<JudgeResult>;
  const clamp = (n: unknown, d: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : d;
  const verdict =
    r.verdict === 'qualify' || r.verdict === 'caution' || r.verdict === 'reject' ? r.verdict : 'caution';
  return {
    fitScore: clamp(r.fitScore, 0),
    verdict,
    redFlags: Array.isArray(r.redFlags) ? r.redFlags.filter((x): x is string => typeof x === 'string') : [],
    betterFitProfile: typeof r.betterFitProfile === 'string' ? r.betterFitProfile : '',
    reasoning: Array.isArray(r.reasoning) ? r.reasoning.filter((x): x is string => typeof x === 'string') : [],
    confidence: clamp(r.confidence, 60),
  };
}

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!env.ANTHROPIC_KEY) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_KEY });
  return anthropicClient;
}

async function judgeViaAnthropic(input: JudgeInput): Promise<JudgeResult | null> {
  const anthropic = getAnthropic();
  if (!anthropic) return null;
  try {
    const message = await anthropic.messages.create({
      model: SCORING_MODEL,
      max_tokens: 1024,
      system: buildSystem(input.brief),
      tools: [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: TOOL_SCHEMA }],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: buildUser(input) }],
    });
    if (message.stop_reason === 'refusal') return null;
    const block = message.content.find((b) => b.type === 'tool_use');
    return block && block.type === 'tool_use' ? normalizeResult(block.input) : null;
  } catch {
    return null;
  }
}

// On-prem LLM via the LiteLLM proxy (OpenAI-compatible Chat Completions + function
// calling for the structured verdict). Returns null on any error so judgeLead falls
// back to Anthropic — a flaky/unreachable proxy never blocks scoring.
async function judgeViaLiteLLM(input: JudgeInput): Promise<JudgeResult | null> {
  const base = process.env.LITELLM_BASE_URL;
  const key = process.env.LITELLM_API_KEY;
  if (!base || !key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.LITELLM_MODEL || 'smart',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: buildSystem(input.brief) },
          { role: 'user', content: buildUser(input) },
        ],
        tools: [{ type: 'function', function: { name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: TOOL_SCHEMA } }],
        tool_choice: { type: 'function', function: { name: TOOL_NAME } },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> }
      | null;
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return null;
    return normalizeResult(typeof args === 'string' ? JSON.parse(args) : args);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function judgeLead(input: JudgeInput): Promise<JudgeResult | null> {
  if (process.env.LLM_PROVIDER === 'litellm') {
    const viaLite = await judgeViaLiteLLM(input);
    if (viaLite) return viaLite; // else fall back to Anthropic
  }
  return judgeViaAnthropic(input);
}
