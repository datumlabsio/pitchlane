import { describe, expect, it } from 'vitest';

import {
  buildDailyDigestBody,
  buildDailyDigestFallbackBody,
  buildDigestTableRows,
  formatConPerApp,
  formatFraction,
  formatPct,
  pktYesterdayWindow,
  rowSignal,
  shouldSendDailyDigest,
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

/** PKT 4:00 on a given calendar date → UTC instant (PKT = UTC+5). */
function pktAt(isoDate: string, hour = 4): Date {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, hour - 5, 0, 0));
}

describe('rowSignal', () => {
  it('marks applied under 3 as red', () => {
    expect(rowSignal({ applied: 0 })).toBe('red');
    expect(rowSignal({ applied: 2 })).toBe('red');
  });

  it('marks applied 3+ as green', () => {
    expect(rowSignal({ applied: 3 })).toBe('green');
    expect(rowSignal({ applied: 6 })).toBe('green');
  });
});

describe('shouldSendDailyDigest', () => {
  it('sends Tue–Sat 4am PKT (yesterday was Mon–Fri)', () => {
    // Tue 2026-07-28 4am PKT → yesterday Mon
    expect(shouldSendDailyDigest(pktAt('2026-07-28'))).toBe(true);
    // Sat 2026-07-25 4am PKT → yesterday Fri
    expect(shouldSendDailyDigest(pktAt('2026-07-25'))).toBe(true);
  });

  it('skips Sun and Mon 4am PKT (yesterday was Sat/Sun)', () => {
    // Sun 2026-07-26 4am PKT → yesterday Sat
    expect(shouldSendDailyDigest(pktAt('2026-07-26'))).toBe(false);
    // Mon 2026-07-27 4am PKT → yesterday Sun
    expect(shouldSendDailyDigest(pktAt('2026-07-27'))).toBe(false);
  });

  it('pktYesterdayWindow labels match the calendar day before the fire time', () => {
    expect(pktYesterdayWindow(pktAt('2026-07-25')).label).toBe('2026-07-24');
    expect(pktYesterdayWindow(pktAt('2026-07-27')).label).toBe('2026-07-26');
  });
});

describe('format helpers', () => {
  it('uses an en-dash for zero denominators', () => {
    expect(formatFraction(0, 0)).toBe('–');
    expect(formatConPerApp(20, 0)).toBe('–');
  });

  it('formats Proposal view / BU review fractions and con/app', () => {
    expect(formatFraction(1, 6)).toBe('1/6');
    expect(formatConPerApp(115, 6)).toBe('19');
  });

  it('formats rates as 0% when denominator is zero', () => {
    expect(formatPct(0, 0)).toBe('0%');
    expect(formatPct(24, 46)).toBe('52%');
  });
});

describe('buildDigestTableRows', () => {
  it('sorts red → green, then leadsIn desc, without a Total row', () => {
    const profiles = buildDigestTableRows(SAMPLE).map((r) => r.profile);
    expect(profiles).toEqual(['Abdur Rehman', 'Humayun Jawad', 'Faizan Khan']);
  });

  it('drops inactive profiles', () => {
    expect(buildDigestTableRows(SAMPLE).some((r) => r.profile === 'Idle')).toBe(false);
  });
});

describe('buildDailyDigestBody', () => {
  it('renders funnel, spend, compact profile rows, and context total', () => {
    const body = buildDailyDigestBody(SAMPLE, { connectRateUsd: 0.15 });
    const text = allText(body);

    expect(body.text).toContain('Daily Upwork metrics — 2026-07-21');
    expect(text).toContain('46 in → 24 qualified (52%) → 14 applied (58%)');
    expect(text).toContain('💰 270 connects • $40.50 • 19 con/app');
    expect(text).not.toContain('Replies');

    expect(body.blocks.some((b) => b.type === 'table')).toBe(false);
    expect(body.blocks.filter((b) => b.type === 'divider')).toHaveLength(2);

    expect(text).toContain('🔴 *Abdur Rehman*   14 in • 5 qual • 1 app • 0/1 Proposal view • 0/1 BU review');
    expect(text).toContain('🔴 *Humayun Jawad*   13 in • 12 qual • 0 app • – Proposal view • – BU review');
    expect(text).toContain(
      '🟢 *Faizan Khan*   11 in • 4 qual • 6 app • 1/6 Proposal view • 0/6 BU review',
    );
    expect(text).toContain('Total: 14 applied • 1/14 Proposal view • 0/14 BU review');
  });

  it('respects a custom connect rate for spend', () => {
    const body = buildDailyDigestBody(SAMPLE, { connectRateUsd: 0.2 });
    expect(allText(body)).toContain('$54.00');
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
  it('matches the primary compact body', () => {
    const primary = buildDailyDigestBody(SAMPLE, { connectRateUsd: 0.15 });
    const fallback = buildDailyDigestFallbackBody(SAMPLE, { connectRateUsd: 0.15 });
    expect(fallback).toEqual(primary);
  });
});
