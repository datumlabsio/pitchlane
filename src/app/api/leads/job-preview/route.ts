import { NextResponse } from 'next/server';
import { z } from 'zod';

import { fetchUpworkJob, isScrapeConfigured } from '@/lib/scrape/upwork';
import { fetchUpworkJobViaApi, isUpworkApiEnabled } from '@/lib/upwork/api';
import type { EnrichOutcome } from '@/lib/scrape/upwork';

// The Bright Data fallback can take ~45–75s to render an Upwork page.
export const maxDuration = 90;

const requestSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => /upwork\.com\/(jobs|freelance-jobs)\//i.test(u) || /~[0-9a-z]{6,}/i.test(u), {
      message: 'That does not look like an Upwork job URL.',
    }),
});

/**
 * Fetch a job's details from its Upwork URL so the Add-lead dialog can prefill
 * title/description/budget/skills. Read-only — nothing is stored; the lead is
 * created (and properly enriched + judged) only when the form is submitted.
 */
export async function POST(request: Request) {
  try {
    const { url } = requestSchema.parse(await request.json());

    if (!isUpworkApiEnabled() && !isScrapeConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Enrichment is not configured — connect Upwork under Settings first.' },
        { status: 400 },
      );
    }

    // Same API-first / scraper-fallback order as lead enrichment.
    let outcome: EnrichOutcome = isUpworkApiEnabled()
      ? await fetchUpworkJobViaApi(url)
      : { status: 'failed' };
    if (outcome.status !== 'enriched' && isScrapeConfigured()) {
      outcome = await fetchUpworkJob(url);
    }

    if (outcome.status !== 'enriched') {
      return NextResponse.json({
        ok: true,
        outcome: outcome.status, // 'private' | 'failed'
      });
    }

    const d = outcome.data;
    const c = d.client;
    const clientSummary = [
      [c.location, c.country].filter(Boolean).join(', '),
      c.totalSpent ? `${c.totalSpent} spent` : null,
      c.totalHires != null ? `${c.totalHires} hires` : null,
      c.paymentVerified ? 'payment verified' : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return NextResponse.json({
      ok: true,
      outcome: 'enriched',
      job: {
        title: d.title ?? '',
        description: d.description ?? '',
        budget: d.budget ?? '',
        paymentType: d.paymentType ?? '',
        skills: d.skills ?? [],
        proposalsCount: d.proposalsCount ?? null,
        clientSummary,
        source: d.source ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not fetch the job.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
