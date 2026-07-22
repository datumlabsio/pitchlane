import { describe, expect, it } from 'vitest';

import {
  buildDailyDigestBody,
  buildDailyDigestFallbackBody,
  buildDigestTableRows,
  formatConPerApp,
  formatFraction,
  formatPct,
  rowSignal,
  type DailyDigest,
  type ProfileRow,
} from '@/domain/metrics/daily-digest';

function row(partial: Partial<ProfileRow> & { profile: string }): ProfileRow {
  return {
    leadsIn: 0,
    qualified: 0,
    applied: 0,
    proposalViewed: 0,
    buReviewed: 0,
    replies: 0,
    calls: 0,
    won: 0,
    connectsSpent: 0,
    ...partial,
  };
}

const SAMPLE: DailyDigest = {
  windowLabel: '2026-07-21',
  rows: [
    row({
      profile: 'Abdur Rehman',
      leadsIn: 14,
      qualified: 5,
      applied: 1,
      proposalViewed: 0,
      buReviewed: 0,
      replies: 1,
      connectsSpent: 20,
    }),
    row({
      profile: 'Humayun Jawad',
      leadsIn: 13,
      qualified: 12,
      applied: 0,
    }),
    row({
      profile: 'Faizan Khan',
      leadsIn: 11,
      qualified: 4,
      applied: 6,
      proposalViewed: 1,
      buReviewed: 0,
      calls: 1,
      connectsSpent: 115,
    }),
    row({ profile: 'Idle', leadsIn: 0 }),
  ],
  totals: {
    leadsIn: 46,
    qualified: 24,
    applied: 14,
    proposalViewed: 1,
    buReviewed: 0,
    replies: 1,
    calls: 1,
    won: 0,
    connectsSpent: 270,
  },
};

function allText(body: { text: string; blocks: Array<Record<string, unknown>> }): string {
  return JSON.stringify(body);
}

describe('rowSignal', () => {
  it('marks qualified with zero applied as red', () => {
    expect(rowSignal({ qualified: 12, applied: 0 })).toBe('red');
  });

  it('marks applied with zero qualified as red', () => {
    expect(rowSignal({ qualified: 0, applied: 3 })).toBe('red');
  });

  it('marks applied/qualified under 50% as yellow', () => {
    expect(rowSignal({ qualified: 5, applied: 1 })).toBe('yellow');
  });

  it('marks healthy convertors as green', () => {
    expect(rowSignal({ qualified: 4, applied: 6 })).toBe('green');
    expect(rowSignal({ qualified: 4, applied: 2 })).toBe('green');
  });
});

describe('format helpers', () => {
  it('uses an en-dash for zero denominators', () => {
    expect(formatFraction(0, 0)).toBe('–');
    expect(formatConPerApp(20, 0)).toBe('–');
  });

  it('formats PV/BU fractions and con/app', () => {
    expect(formatFraction(1, 6)).toBe('1/6');
    expect(formatConPerApp(115, 6)).toBe('19');
  });

  it('formats rates as 0% when denominator is zero', () => {
    expect(formatPct(0, 0)).toBe('0%');
    expect(formatPct(24, 46)).toBe('52%');
  });
});

describe('buildDigestTableRows', () => {
  it('sorts red → yellow → green, then leadsIn desc, and appends Total', () => {
    const profiles = buildDigestTableRows(SAMPLE).map((r) => r.profile);
    expect(profiles).toEqual(['Humayun Jawad', 'Abdur Rehman', 'Faizan Khan', 'Total']);
  });

  it('drops inactive profiles', () => {
    expect(buildDigestTableRows(SAMPLE).some((r) => r.profile === 'Idle')).toBe(false);
  });
});

describe('buildDailyDigestBody', () => {
  it('renders funnel rates, spend, and a native table with PV/BU columns', () => {
    const body = buildDailyDigestBody(SAMPLE, { connectRateUsd: 0.15 });
    const text = allText(body);

    expect(body.text).toContain('Daily digest — 2026-07-21');
    expect(text).toContain('46 in → 24 qualified (52%) → 14 applied (58%)');
    expect(text).toContain('270 connects · $40.50 spent · 19 con/app');
    expect(text).toContain('Replies 1 · Calls 1 · Won 0');

    const table = body.blocks.find((b) => b.type === 'table') as {
      rows: Array<Array<{ text: string }>>;
    };
    expect(table).toBeTruthy();
    const header = table.rows[0]!.map((c) => c.text);
    expect(header).toEqual(['', 'Profile', 'In', 'Qual', 'App', 'PV', 'BU', 'Con/App']);

    const humayun = table.rows.find((r) => r[1]?.text === 'Humayun Jawad');
    expect(humayun?.[0]?.text).toBe('🔴');
    expect(humayun?.[5]?.text).toBe('–');
    expect(humayun?.[6]?.text).toBe('–');

    const faizan = table.rows.find((r) => r[1]?.text === 'Faizan Khan');
    expect(faizan?.[0]?.text).toBe('🟢');
    expect(faizan?.[5]?.text).toBe('1/6');
    expect(faizan?.[6]?.text).toBe('0/6');
    expect(faizan?.[7]?.text).toBe('19');

    const total = table.rows[table.rows.length - 1]!;
    expect(total[1]?.text).toBe('Total');
    expect(total[5]?.text).toBe('1/14');
    expect(total[6]?.text).toBe('0/14');
  });

  it('respects a custom connect rate for spend', () => {
    const body = buildDailyDigestBody(SAMPLE, { connectRateUsd: 0.2 });
    expect(allText(body)).toContain('$54.00 spent');
  });

  it('omits the replies line when all three are zero', () => {
    const quiet: DailyDigest = {
      ...SAMPLE,
      totals: { ...SAMPLE.totals, replies: 0, calls: 0, won: 0 },
    };
    expect(allText(buildDailyDigestBody(quiet))).not.toContain('Replies');
  });

  it('has no eye emoji and no footer backlog copy', () => {
    const text = allText(buildDailyDigestBody(SAMPLE));
    expect(text).not.toContain('👀');
    expect(text).not.toContain('await BU review');
    expect(text).not.toContain('sitting unapplied');
  });

  it('keeps dashboard action buttons', () => {
    const actions = buildDailyDigestBody(SAMPLE).blocks.find((b) => b.type === 'actions');
    expect(actions).toBeTruthy();
  });
});

describe('buildDailyDigestFallbackBody', () => {
  it('renders a monospace matrix with the same sort and fractions', () => {
    const body = buildDailyDigestFallbackBody(SAMPLE, { connectRateUsd: 0.15 });
    const text = allText(body);
    expect(body.blocks.some((b) => b.type === 'table')).toBe(false);
    expect(text).toContain('```');
    expect(text).toContain('Humayun Jawad');
    expect(text).toContain('1/6');
    expect(text).toContain('0/6');
    expect(text).toContain('$40.50 spent');
    expect(text).not.toContain('👀');
  });
});
