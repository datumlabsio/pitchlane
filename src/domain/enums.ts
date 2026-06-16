// Plain const mirrors of Prisma enums — safe to import in client components.
// Server-side code can import either from here or directly from @prisma/client.

export const ProposalTone = {
  CONSULTATIVE: 'CONSULTATIVE',
  DIRECT: 'DIRECT',
  EXPERT: 'EXPERT',
  FRIENDLY: 'FRIENDLY',
} as const;
export type ProposalTone = (typeof ProposalTone)[keyof typeof ProposalTone];

export const LeadStatus = {
  NEW: 'NEW',
  QUALIFIED: 'QUALIFIED',
  REJECTED: 'REJECTED',
  APPLIED: 'APPLIED',
  CLIENT_REPLIED: 'CLIENT_REPLIED',
  INTRO_CALL: 'INTRO_CALL',
  FOLLOW_UP: 'FOLLOW_UP',
  ONGOING_DISCUSSION: 'ONGOING_DISCUSSION',
  HIRES_OTHER: 'HIRES_OTHER',
  QUALIFIED_LOST: 'QUALIFIED_LOST',
  JOB_CLOSED: 'JOB_CLOSED',
  WON: 'WON',
  LOST: 'LOST',
  CLOSED: 'CLOSED',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const LeadSource = {
  UPWORK: 'UPWORK',
  EMAIL_FORWARD: 'EMAIL_FORWARD',
  INVITE: 'INVITE',
  MANUAL: 'MANUAL',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];
