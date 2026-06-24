import { env } from '@/lib/env';
import { getUpworkAccessToken } from '@/lib/upwork/auth';
import type { EnrichOutcome, JobEnrichment } from '@/lib/scrape/upwork';

const ENDPOINT = 'https://api.upwork.com/graphql';

/** Returns true when Upwork API credentials are configured (a token may still be absent). */
export function isUpworkApiEnabled(): boolean {
  return Boolean(env.UPWORK_CLIENT_ID && env.UPWORK_CLIENT_SECRET);
}

/**
 * The numeric job id a lead URL points at, fetchable via marketplaceJobPosting(id).
 * Upwork job URLs carry a `~02<id>` ciphertext (e.g. /jobs/~022069653541814550194)
 * where the global job id is the ciphertext minus the `~02` prefix. Older `~01…`
 * (hex) ciphertexts don't decode this way and return null → callers fall back to scrape.
 */
export function upworkJobId(url: string | null | undefined): string | null {
  return url?.match(/~02(\d{6,})/)?.[1] ?? null;
}

// Public scope can fetch a job directly by id. It returns the full description,
// contract terms (incl. hourly budget ranges) and public client info (payment
// verification + location) — richer than the public search, which masks those.
// Note: Skill.preferredLabel/name are scope-blocked and Skill.prettyName comes back
// empty here, so we don't request skills (the job-alert email already supplies them).
const JOB_QUERY = `query Job($id: ID!) {
  marketplaceJobPosting(id: $id) {
    id
    content { title description }
    contractTerms {
      contractType
      experienceLevel
      fixedPriceContractTerms { amount { rawValue currency } }
      hourlyContractTerms { hourlyBudgetMin hourlyBudgetMax }
    }
    clientCompanyPublic {
      country { name }
      state
      city
      paymentVerification { paymentVerified }
    }
  }
}`;

type Money = { rawValue?: string | number | null; currency?: string | null } | null;
type JobNode = {
  content?: { title?: string | null; description?: string | null } | null;
  contractTerms?: {
    contractType?: string | null;
    experienceLevel?: string | null;
    fixedPriceContractTerms?: { amount?: Money } | null;
    hourlyContractTerms?: { hourlyBudgetMin?: number | null; hourlyBudgetMax?: number | null } | null;
  } | null;
  clientCompanyPublic?: {
    country?: { name?: string | null } | null;
    state?: string | null;
    city?: string | null;
    paymentVerification?: { paymentVerified?: boolean | null } | null;
  } | null;
};

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(2);
}

function moneyStr(amount: Money | undefined): string | undefined {
  const raw = amount?.rawValue == null ? NaN : Number(amount.rawValue);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  const sym = !amount?.currency || amount.currency === 'USD' ? '$' : `${amount.currency} `;
  return `${sym}${fmtNum(raw)}`;
}

function budgetFromTerms(terms: JobNode['contractTerms']): { budget?: string; paymentType?: string } {
  const fixed = moneyStr(terms?.fixedPriceContractTerms?.amount);
  if (fixed) return { budget: fixed, paymentType: 'Fixed-price' };

  const min = terms?.hourlyContractTerms?.hourlyBudgetMin ?? null;
  const max = terms?.hourlyContractTerms?.hourlyBudgetMax ?? null;
  if (min != null || max != null) {
    let budget: string;
    if (min != null && max != null) budget = `$${fmtNum(min)}–${fmtNum(max)}/hr`;
    else if (min != null) budget = `$${fmtNum(min)}+/hr`;
    else budget = `up to $${fmtNum(max as number)}/hr`;
    return { budget, paymentType: 'Hourly' };
  }
  const t = terms?.contractType;
  return { paymentType: t === 'HOURLY' ? 'Hourly' : t === 'FIXED' ? 'Fixed-price' : undefined };
}

function toEnrichment(job: JobNode): JobEnrichment {
  const { budget, paymentType } = budgetFromTerms(job.contractTerms);
  const cc = job.clientCompanyPublic;

  const client: JobEnrichment['client'] = {};
  if (cc?.country?.name) client.country = cc.country.name;
  const location = [cc?.city, cc?.state].map((s) => s?.trim()).filter(Boolean).join(', ');
  if (location) client.location = location;
  if (typeof cc?.paymentVerification?.paymentVerified === 'boolean') {
    client.paymentVerified = cc.paymentVerification.paymentVerified;
  }

  return {
    source: 'upwork_api',
    description: job.content?.description?.trim() || undefined,
    budget,
    paymentType,
    experienceLevel: job.contractTerms?.experienceLevel ?? undefined,
    skills: [], // see JOB_QUERY note — skill names aren't available here; email skills are kept
    client,
    fetchedAt: new Date().toISOString(),
    raw: job,
  };
}

/**
 * Enrich a lead from the official Upwork API by fetching the job directly by id
 * (derived from the lead URL's `~02…` ciphertext). Returns the same 3-state
 * EnrichOutcome as the scraper, so callers fall back to Bright Data on anything but
 * 'enriched' (invite-only / closed / `~01…`-ciphertext / not-found jobs all 404 here).
 */
export async function fetchUpworkJobViaApi(url: string): Promise<EnrichOutcome> {
  const id = upworkJobId(url);
  if (!id) return { status: 'failed' };

  const token = await getUpworkAccessToken();
  if (!token) return { status: 'failed' };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: JOB_QUERY, variables: { id } }),
    });
  } catch {
    return { status: 'failed' };
  }
  if (!res.ok) return { status: 'failed' };

  const json = (await res.json().catch(() => null)) as {
    data?: { marketplaceJobPosting?: JobNode | null };
  } | null;
  const job = json?.data?.marketplaceJobPosting;

  // null/404 (job closed, invite-only, or otherwise not public) or no body: let the
  // caller fall back to the scraper rather than record a thin result.
  if (!job || !job.content?.description?.trim()) return { status: 'failed' };
  return { status: 'enriched', data: toEnrichment(job) };
}
