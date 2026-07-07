import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';

export type ProposalGenerationInput = {
  profileName: string;
  roleFocus: string;
  /** The freelancer's own profile summary (profileConfig.jdSummary) — grounds claims. */
  profileSummary?: string;
  proposalTone: string;
  proposalRules: string[];
  reusableSnippets: string[];
  title: string;
  emailSubject: string;
  /** Full job description (enriched when available, else email body). */
  emailBody: string;
  // Enrichment facts about the job + client (when available).
  jobBudget?: string;
  jobSkills?: string[];
  clientSummary?: string;
  proposalsCount?: number;
  /** When regenerating, the current draft the reviewer wants improved. */
  previousProposal?: string;
  /** Free-text reviewer feedback to steer the rewrite. */
  feedback?: string;
};

function buildSystemPrompt(input: ProposalGenerationInput): string {
  const rules = input.proposalRules.length
    ? input.proposalRules.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : [
        '1. Never open with "Hi/Hello/I am" — start with a sharp, problem-focused insight.',
        '2. Mirror 5–8 of the job post\'s key technical/business keywords naturally.',
        '3. Keep it 150–200 words, confident and consultative — no fluff, no begging.',
        '4. Close with one specific question and a clear call to action.',
      ].join('\n');

  const snippets = input.reusableSnippets.length
    ? `\n\nReusable proof points you MAY weave in when relevant (do not force all of them):\n${input.reusableSnippets.map((s) => `- ${s}`).join('\n')}`
    : '';

  const profileBlock = input.profileSummary?.trim()
    ? `\n\nABOUT THE FREELANCER (ground every claim in this — never invent experience beyond it):\n${input.profileSummary.trim()}`
    : '';

  return [
    `You are an elite Upwork proposal writer drafting on behalf of ${input.profileName}, a senior freelancer focused on ${input.roleFocus}.`,
    `Write in a ${input.proposalTone.toLowerCase()} tone.`,
    profileBlock,
    '',
    'Follow these rules exactly:',
    rules,
    '',
    'Hard constraints:',
    '- Output ONLY the proposal text. No preamble, no "Here is your proposal", no markdown headings, no subject line.',
    '- Before writing, extract every explicit requirement, deliverable, and applicant instruction from the job post. The proposal must speak to the requirements that matter most and never contradict any of them.',
    '- If the post asks applicants anything — screening questions, "answer these", "include X in your proposal", a code word to prove you read it, a required reply format — comply EXACTLY. Answer every question at the end under a plain "Answers:" line, numbered to match, 1 to 3 specific sentences each, grounded in the freelancer profile. Skipping or half-answering these is an automatic rejection. These answers are mandatory and exempt from any word limit in the rules above.',
    '- Use the client history and budget to calibrate your angle and pricing framing where natural — do not quote a rate unless it fits.',
    '- Ground every claim in the freelancer\'s focus area + the "About the freelancer" summary. Never invent clients, metrics, or experience not implied there.',
    '- Write as the freelancer (first person), addressed to the client.',
    snippets,
  ].join('\n');
}

function buildUserPrompt(input: ProposalGenerationInput): string {
  const facts: string[] = [];
  if (input.jobBudget) facts.push(`Budget: ${input.jobBudget}`);
  if (input.jobSkills?.length) facts.push(`Skills: ${input.jobSkills.join(', ')}`);
  if (input.proposalsCount != null) facts.push(`Proposals submitted so far: ${input.proposalsCount}`);
  if (input.clientSummary) facts.push(`Client: ${input.clientSummary}`);

  const base = [
    'JOB POST',
    `Title: ${input.emailSubject || input.title}`,
    ...(facts.length ? ['', ...facts] : []),
    '',
    'Description:',
    input.emailBody?.trim() || '(No description captured — infer intent from the title.)',
  ].join('\n');

  if (input.feedback?.trim() && input.previousProposal?.trim()) {
    return [
      base,
      '',
      '---',
      'CURRENT DRAFT (revise this):',
      input.previousProposal.trim(),
      '',
      'REVIEWER FEEDBACK (apply precisely, keep what already works):',
      input.feedback.trim(),
      '',
      'Rewrite the proposal incorporating the feedback above.',
    ].join('\n');
  }

  if (input.feedback?.trim()) {
    return [base, '', 'REVIEWER FEEDBACK to honor while drafting:', input.feedback.trim()].join('\n');
  }

  return base;
}

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic | null {
  if (!env.ANTHROPIC_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_KEY });
  }
  return anthropicClient;
}

/**
 * Write a proposal with the configured provider. Anthropic stays the default and
 * fully wired; set LLM_PROVIDER=litellm (+ LITELLM_* env) to route to the on-prem,
 * OpenAI-compatible model instead. Switching back is just the env var.
 */
export async function generateProposalDraft(input: ProposalGenerationInput) {
  if (env.LLM_PROVIDER === 'litellm' && env.LITELLM_BASE_URL && env.LITELLM_API_KEY) {
    return generateViaLiteLLM(input);
  }
  return generateViaAnthropic(input);
}

// On-prem LLM via the LiteLLM proxy (OpenAI-compatible Chat Completions). Reuses the
// exact same prompts as the Anthropic path; falls back to the template draft on any
// error/timeout so a flaky on-prem model never blocks ingestion.
async function generateViaLiteLLM(input: ProposalGenerationInput) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${env.LITELLM_BASE_URL!.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.LITELLM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.LITELLM_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(input) },
          { role: 'user', content: buildUserPrompt(input) },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return fallbackProposal(input);
    const json = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const text = json?.choices?.[0]?.message?.content?.trim();
    return text || fallbackProposal(input);
  } catch {
    return fallbackProposal(input);
  } finally {
    clearTimeout(timer);
  }
}

async function generateViaAnthropic(input: ProposalGenerationInput) {
  const anthropic = getAnthropic();
  if (!anthropic) {
    return fallbackProposal(input);
  }

  try {
    // Adaptive thinking lets Claude plan the proposal against every rule before
    // writing — the whole point here is faithful adherence to the profile config.
    // Stream so a longer (thinking) turn never trips an HTTP timeout. Thinking
    // tokens share max_tokens, so the cap must leave generous room for both a
    // long planning phase AND the draft — 4096 produced mid-sentence cutoffs.
    const message = await anthropic.messages
      .stream({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 16384,
        thinking: { type: 'adaptive' },
        system: buildSystemPrompt(input),
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      })
      .finalMessage();

    if (message.stop_reason === 'refusal') {
      return fallbackProposal(input);
    }

    let text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    // If the budget was still exhausted, drop the trailing sentence fragment —
    // a draft that stops cleanly beats one that dies mid-word.
    if (message.stop_reason === 'max_tokens') {
      const trimmed = text.replace(/[^.!?]*$/, '').trim();
      if (trimmed) text = trimmed;
    }

    return text || fallbackProposal(input);
  } catch {
    return fallbackProposal(input);
  }
}

function fallbackProposal(input: ProposalGenerationInput) {
  const opening = input.proposalTone === 'EXPERT'
    ? `I help teams ship ${input.roleFocus.toLowerCase()} work with clear ownership and delivery discipline.`
    : `This looks aligned with the kind of ${input.roleFocus.toLowerCase()} work I support regularly.`;

  return [
    `Hi,`,
    opening,
    `Your requirement for "${input.title}" stands out because the forwarded brief points to a practical delivery need rather than generic staffing.`,
    `Based on the email context, I would approach this by first clarifying the target outcome, validating the current workflow, and then translating that into a delivery plan with visible milestones.`,
    input.reusableSnippets[0] || `I can adapt quickly to the stack and communication rhythm that the project needs.`,
    `If the project is still open, I can share a focused execution approach and the first questions I would resolve before implementation begins.`,
    `Best,`,
    input.profileName,
  ].join('\n\n');
}
