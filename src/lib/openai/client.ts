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
    '- Base the proposal on the FULL job description and the client facts provided. Address the specific requirements named in the description.',
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

export async function generateProposalDraft(input: ProposalGenerationInput) {
  if (!env.OPENAI_API_KEY) {
    return fallbackProposal(input);
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: buildSystemPrompt(input) }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: buildUserPrompt(input) }],
        },
      ],
      max_output_tokens: 700,
    }),
  });

  if (!response.ok) {
    return fallbackProposal(input);
  }

  const payload = (await response.json()) as { output_text?: string };
  return payload.output_text?.trim() || fallbackProposal(input);
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
