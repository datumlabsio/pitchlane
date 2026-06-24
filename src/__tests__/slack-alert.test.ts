import { describe, expect, it } from 'vitest';

import { buildLeadAlertBody, type SlackLeadPayload } from '@/lib/slack';

const BASE: SlackLeadPayload = {
  variant: 'enriched',
  profileName: 'Alex',
  title: 'AI developer',
  score: 82,
  hot: true,
  confidence: 'High',
  status: 'QUALIFIED',
  budget: '$30–60/hr',
  paymentType: 'Hourly',
  experienceLevel: 'EXPERT',
  clientLocation: 'Karachi, Pakistan',
  paymentVerified: true,
  skills: ['Python', 'AI'],
  matchedKeywords: ['ai', 'automation'],
  source: 'upwork_api',
  receivedAt: new Date(),
  leadId: 'lead_1',
  sourceUrl: 'https://www.upwork.com/jobs/~02x',
};

/** All text rendered across the message body, for substring assertions. */
function rendered(payload: SlackLeadPayload): string {
  const body = buildLeadAlertBody(payload);
  const blockText = body.blocks
    .map((b) => {
      const blk = b as Record<string, any>;
      if (blk.type === 'section') return blk.text.text;
      if (blk.type === 'context') return blk.elements.map((e: any) => e.text).join(' ');
      if (blk.type === 'actions') return blk.elements.map((e: any) => e.text.text).join(' ');
      return '';
    })
    .join('\n');
  return `${body.text}\n${blockText}`;
}

describe('buildLeadAlertBody', () => {
  it('renders a hot enriched lead with rich meta and no description/proposal', () => {
    const out = rendered(BASE);
    expect(out).toContain('🟢');
    expect(out).toContain('Match 82%');
    expect(out).toContain('$30–60/hr · Hourly · Expert level');
    expect(out).toContain('Karachi, Pakistan · ✅ Payment verified');
    expect(out).toContain('Python · AI');
    expect(out).toContain('via Upwork API');
    // meta-only: the old description/proposal blocks are gone
    expect(out).not.toContain('Description');
    expect(out).not.toContain('Proposal');
  });

  it('uses the ⚪ dot when the lead is not hot', () => {
    const out = rendered({ ...BASE, hot: false });
    expect(out).toContain('⚪');
    expect(out).not.toContain('🟢');
  });

  it('marks unverified clients and shows competition from the scraper', () => {
    const out = rendered({ ...BASE, paymentVerified: false, source: 'bright_data', proposalsCount: 12 });
    expect(out).toContain('⚠️ Unverified');
    expect(out).toContain('12 proposals');
    expect(out).toContain('via web scrape');
  });

  it('still alerts on failed enrichment with email meta and a note', () => {
    const out = rendered({
      variant: 'failed',
      profileName: 'Alex',
      title: 'AI Receptionist',
      score: 55,
      hot: true,
      confidence: 'Medium',
      status: 'NEW',
      budget: '$200–400',
      skills: ['VAPI'],
      matchedKeywords: ['ai'],
      receivedAt: new Date(),
      leadId: 'lead_2',
      sourceUrl: 'https://www.upwork.com/jobs/~02z',
    });
    expect(out).toContain('Couldn’t fetch the description');
    expect(out).toContain('$200–400');
    // no client line / source badge when we couldn't enrich
    expect(out).not.toContain('Payment verified');
    expect(out).not.toContain('via Upwork API');
  });

  it('always includes both action buttons', () => {
    const body = buildLeadAlertBody(BASE);
    const actions = body.blocks.find((b) => (b as Record<string, unknown>).type === 'actions') as Record<string, any>;
    const labels = actions.elements.map((e: any) => e.text.text);
    expect(labels).toEqual(['View on Upwork', 'Open in Pitchlane']);
  });
});
