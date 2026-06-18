import { env } from '@/lib/env';

// Normalized job enrichment scraped from the public Upwork job page.
export type JobEnrichment = {
  description?: string;
  budget?: string;
  paymentType?: string;
  skills: string[];
  proposalsCount?: number;
  client: {
    location?: string;
    country?: string;
    totalSpent?: string;
    totalHires?: number;
    activeHires?: number;
    hours?: number;
    rating?: number;
    paymentVerified?: boolean;
    memberSince?: string;
    industry?: string;
    companySize?: string;
  };
  fetchedAt: string;
  raw?: unknown;
};

// Enrichment is OFF unless explicitly enabled. Flip LEAD_ENRICHMENT_ENABLED=true
// (and set ZENROWS_API_KEY) to turn it back on — all the code below stays intact.
export function isScrapeConfigured(): boolean {
  return Boolean(env.ZENROWS_API_KEY) && env.LEAD_ENRICHMENT_ENABLED === 'true';
}

const FETCH_TIMEOUT_MS = 70_000;
const MAX_ATTEMPTS = 3;

async function fetchOnce(url: string): Promise<JobEnrichment | null> {
  const endpoint =
    `https://api.zenrows.com/v1/?apikey=${encodeURIComponent(env.ZENROWS_API_KEY!)}` +
    `&url=${encodeURIComponent(url)}&js_render=true&premium_proxy=true&wait=5000`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) return null; // e.g. RESP001 = Upwork blocked this proxy; retry
    const html = await response.text();
    const parsed = parseUpworkJobHtml(html);
    // Require a description — otherwise treat as a failed scrape.
    return parsed.description ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the public Upwork job page through ZenRows (JS render + residential
 * proxy to get past Upwork's bot block) and parse the full job + client data.
 * Upwork blocks proxies intermittently (ZenRows RESP001), so we retry a few
 * times. Returns null after all attempts so callers fall back to email-only.
 */
export async function fetchUpworkJob(url: string): Promise<JobEnrichment | null> {
  if (!env.ZENROWS_API_KEY || !url) return null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await fetchOnce(url);
    if (result) return result;
  }
  return null;
}

// ── HTML parsing ────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Strip tags from a window of HTML starting just AFTER the marker's opening tag. */
function markerWindow(html: string, marker: string, len = 400): string | undefined {
  const idx = html.indexOf(marker);
  if (idx < 0) return undefined;
  const gt = html.indexOf('>', idx);
  const start = gt >= 0 ? gt + 1 : idx;
  const text = stripTags(html.slice(start, start + len));
  return text || undefined;
}

/** The immediate text node of the element bearing this data-qa (clean label values). */
function qaImmediate(html: string, qa: string): string | undefined {
  const m = html.match(new RegExp(`data-qa="${qa}"[^>]*>\\s*([^<]{1,80}?)\\s*<`));
  const v = m?.[1] ? decodeEntities(m[1]).trim() : '';
  return v || undefined;
}

function parseJsonLd(html: string): Record<string, unknown> | null {
  const m = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1].trim());
    const arr = Array.isArray(data) ? data : [data];
    return (arr.find((d) => d && d['@type'] === 'JobPosting') ?? arr[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function budgetFromSalary(salary: unknown): { budget?: string; paymentType?: string } {
  if (!salary || typeof salary !== 'object') return {};
  const s = salary as Record<string, unknown>;
  const currency = typeof s.currency === 'string' ? s.currency : 'USD';
  const value = (s.value && typeof s.value === 'object' ? s.value : {}) as Record<string, unknown>;
  const unit = typeof value.unitText === 'string' ? value.unitText.toLowerCase() : '';
  const min = typeof value.minValue === 'number' ? value.minValue : undefined;
  const max = typeof value.maxValue === 'number' ? value.maxValue : undefined;
  const exact = typeof value.value === 'number' ? value.value : undefined;
  const isHourly = unit === 'hour';
  const suffix = isHourly ? '/hr' : '';
  const sym = currency === 'USD' ? '$' : `${currency} `;
  let budget: string | undefined;
  if (min != null && max != null) budget = `${sym}${min}–${max}${suffix}`;
  else if (exact != null) budget = `${sym}${exact}${suffix}`;
  else if (min != null) budget = `${sym}${min}+${suffix}`;
  return { budget, paymentType: isHourly ? 'Hourly' : exact != null || min != null ? 'Fixed-price' : undefined };
}

export function parseUpworkJobHtml(html: string): JobEnrichment {
  const ld = parseJsonLd(html) ?? {};

  const description = typeof ld.description === 'string' ? stripTags(ld.description) : undefined;
  const { budget, paymentType } = budgetFromSalary(ld.baseSalary);

  const ldSkills = typeof ld.skills === 'string' && ld.skills.trim()
    ? ld.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Client stats via stable data-qa hooks.
  const memberWin = markerWindow(html, 'data-qa="client-contract-date"', 120);
  const memberSince = memberWin?.match(/Member since (.+?\d{4})/)?.[1];

  const spendWin = markerWindow(html, 'data-qa="client-spend"', 200);
  const totalSpent = spendWin?.match(/\$[\d.,]+\s?[KMB]?/)?.[0];

  const hiresWin = markerWindow(html, 'data-qa="client-hires"', 200);
  const totalHires = hiresWin?.match(/([\d,]+)\s*hire/)?.[1];
  const activeHires = hiresWin?.match(/([\d,]+)\s*active/)?.[1];

  const hoursWin = markerWindow(html, 'data-qa="client-hours"', 200);
  const hours = hoursWin?.match(/([\d,]+)\s*hour/)?.[1];

  const locCountry = html.match(/data-qa="client-location"[\s\S]{0,120}?<strong[^>]*>([^<]+)<\/strong>/)?.[1]?.trim();
  const locWin = markerWindow(html, 'data-qa="client-location"', 220);
  const city = locWin
    ? locWin.replace(locCountry ?? '', '').replace(/\d{1,2}:\d{2}\s*[AP]M.*/i, '').trim() || undefined
    : undefined;

  const industry = qaImmediate(html, 'client-company-profile-industry');
  const companySize = qaImmediate(html, 'client-company-profile-size');

  // Job-activity: number of proposals (a range like "5 to 10" or "20 to 50").
  const proposalsWin = markerWindow(html, 'data-qa="client-job-posting-stats"', 600)
    ?? (html.includes('Proposals') ? stripTags(html.slice(html.indexOf('Proposals'), html.indexOf('Proposals') + 120)) : undefined);
  const proposalsCount = proposalsWin?.match(/Proposals:?\s*(?:Less than\s*)?(\d+)/i)?.[1];

  const toNum = (v: string | undefined) => (v ? Number(v.replace(/,/g, '')) : undefined);

  return {
    description,
    budget,
    paymentType,
    skills: ldSkills,
    proposalsCount: toNum(proposalsCount),
    client: {
      location: city,
      country: locCountry,
      totalSpent,
      totalHires: toNum(totalHires),
      activeHires: toNum(activeHires),
      hours: toNum(hours),
      memberSince,
      industry,
      companySize,
    },
    fetchedAt: new Date().toISOString(),
    raw: ld,
  };
}
