import { env } from '@/lib/env';

export type ProposalGenerationInput = {
  profileName: string;
  roleFocus: string;
  proposalTone: string;
  proposalRules: string[];
  reusableSnippets: string[];
  title: string;
  emailSubject: string;
  emailBody: string;
};

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
          content: [
            {
              type: 'input_text',
              text: 'Write a concise Upwork proposal draft. Return plain text only. Keep it professional, specific, and email-context aware.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(input),
            },
          ],
        },
      ],
      max_output_tokens: 350,
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
