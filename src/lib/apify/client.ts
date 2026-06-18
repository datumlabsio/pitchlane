import { env } from '@/lib/env';

// Normalized job enrichment. `raw` keeps the full Apify payload so nothing is
// lost even if the actor renames a field we did not map.
export type JobEnrichment = {
  description?: string;
  budget?: string;
  paymentType?: string;
  skills: string[];
  proposalsCount?: number;
  client: {
    location?: string;
    totalSpent?: string;
    totalHires?: number;
    rating?: number;
    paymentVerified?: boolean;
    memberSince?: string;
  };
  fetchedAt: string;
  raw: unknown;
};

export function isApifyConfigured(): boolean {
  return Boolean(env.APIFY_TOKEN);
}

const FETCH_TIMEOUT_MS = 60_000;

/**
 * Fetch full Upwork job details for a single job URL via the Apify actor.
 * Returns null on any failure (no token, network error, timeout, empty result)
 * so callers can fall back to email-only processing.
 */
export async function fetchUpworkJob(url: string): Promise<JobEnrichment | null> {
  if (!env.APIFY_TOKEN || !url) return null;

  const actor = env.APIFY_UPWORK_ACTOR.replace('/', '~');
  const endpoint = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url }],
        proxyCountryCode: env.APIFY_PROXY_COUNTRY,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const items = (await response.json()) as unknown;
    if (!Array.isArray(items) || items.length === 0) return null;

    return normalizeApifyJob(items[0]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Defensive normalizer ────────────────────────────────────────────────────
// Actor output keys vary, so flatten the payload and probe by keyword instead
// of relying on exact field names.

function flatten(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path.toLowerCase()] = value;
    }
  }
  return out;
}

function findString(flat: Record<string, unknown>, includes: string[], excludes: string[] = []): string | undefined {
  for (const [key, value] of Object.entries(flat)) {
    if (value == null || value === '') continue;
    if (excludes.some((e) => key.includes(e))) continue;
    if (includes.some((i) => key.includes(i))) {
      const str = String(value).trim();
      if (str) return str;
    }
  }
  return undefined;
}

function findNumber(flat: Record<string, unknown>, includes: string[], excludes: string[] = []): number | undefined {
  for (const [key, value] of Object.entries(flat)) {
    if (value == null) continue;
    if (excludes.some((e) => key.includes(e))) continue;
    if (includes.some((i) => key.includes(i))) {
      const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(num)) return num;
    }
  }
  return undefined;
}

function findBool(flat: Record<string, unknown>, includes: string[]): boolean | undefined {
  for (const [key, value] of Object.entries(flat)) {
    if (value == null) continue;
    if (includes.some((i) => key.includes(i))) {
      if (typeof value === 'boolean') return value;
      const str = String(value).toLowerCase();
      if (str === 'true' || str === 'yes' || str === 'verified') return true;
      if (str === 'false' || str === 'no' || str === 'unverified') return false;
    }
  }
  return undefined;
}

export function normalizeApifyJob(raw: unknown): JobEnrichment {
  const flat = flatten(raw);
  const top = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const skills = Array.isArray(top.skills)
    ? (top.skills as unknown[]).map((s) => String(s)).filter(Boolean)
    : Array.isArray(top.tags)
      ? (top.tags as unknown[]).map((s) => String(s)).filter(Boolean)
      : [];

  return {
    description: findString(flat, ['description', 'jobdescription', 'snippet'], ['meta']),
    budget: findString(flat, ['budget', 'paymentamount', 'amount', 'fixedprice', 'hourlyrate'], ['client', 'buyer', 'rating']),
    paymentType: findString(flat, ['paymenttype', 'jobtype', 'pricingtype', 'contracttype']),
    skills,
    proposalsCount: findNumber(flat, ['proposal', 'applicant'], ['rate']),
    client: {
      location: findString(flat, ['country', 'location'], ['restriction']),
      totalSpent: findString(flat, ['spent', 'totalcharged']),
      totalHires: findNumber(flat, ['hire'], ['rate']),
      rating: findNumber(flat, ['rating', 'feedback', 'score'], ['count', 'reviews']),
      paymentVerified: findBool(flat, ['verif']),
      memberSince: findString(flat, ['membersince', 'memberdate', 'joined']),
    },
    fetchedAt: new Date().toISOString(),
    raw,
  };
}
