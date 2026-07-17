import type { LeadStatus } from '@prisma/client';

/**
 * One source of truth for what each pipeline stage means, who moves a lead into
 * it, and when. Used by the /docs stage playbook and as tooltips on the
 * lifecycle pills, so the definitions on screen and in the manual never drift.
 */
export type StageGuideEntry = {
  who: 'Automatic' | 'BD (manual)' | 'Either';
  meaning: string;
  terminal: boolean;
};

export const stageGuide: Record<LeadStatus, StageGuideEntry> = {
  NEW: {
    who: 'Automatic',
    meaning:
      'Entry point — every alert or manually added lead starts here. Also where the judge parks "caution" leads that need a human look. Nothing should live here long.',
    terminal: false,
  },
  QUALIFIED: {
    who: 'Automatic',
    meaning:
      'The AI judge scored the job a clear fit for this profile — worth applying. A draft proposal is generated automatically.',
    terminal: false,
  },
  REJECTED: {
    who: 'Either',
    meaning:
      'Not worth pursuing. Set automatically when the judge hard-rejects (wrong stack, wrong domain, no budget), or manually by BD. The Activity tab shows which.',
    terminal: true,
  },
  APPLIED: {
    who: 'BD (manual)',
    meaning:
      'The application was actually sent on Upwork. Move it the moment you apply — and log the connects spent (the Apply step asks for them).',
    terminal: false,
  },
  CLIENT_REPLIED: {
    who: 'BD (manual)',
    meaning:
      'The client responded in DMs. Move it the moment they reply — before any call is booked (that is First Call).',
    terminal: false,
  },
  INTRO_CALL: {
    who: 'BD (manual)',
    meaning: 'The first call with the client is booked or has happened.',
    terminal: false,
  },
  ONGOING_DISCUSSION: {
    who: 'BD (manual)',
    meaning:
      'All back-and-forth after the first call — negotiations, scoping, follow-ups included. No separate follow-up stage.',
    terminal: false,
  },
  HIRES_OTHER: {
    who: 'BD (manual)',
    meaning:
      'The client hired someone else without ever engaging us — usually straight from Applied.',
    terminal: true,
  },
  JOB_CLOSED: {
    who: 'BD (manual)',
    meaning: 'The client closed or deleted the posting — the job no longer exists.',
    terminal: true,
  },
  WON: {
    who: 'BD (manual)',
    meaning: 'DatumLabs won the project. Log it — win-rate reporting depends on this.',
    terminal: true,
  },
  LOST: {
    who: 'BD (manual)',
    meaning:
      'After replies, calls, or discussion the client chose someone else or went permanently silent.',
    terminal: true,
  },
};
