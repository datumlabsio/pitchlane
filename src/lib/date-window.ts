/**
 * Shared date-range filtering used by the leads list and the metrics/dashboard
 * aggregates. A custom from/to range takes precedence over a preset window.
 *
 * Preset tokens:
 *  - this_week / last_week: Monday 00:00 → Sunday 23:59:59.999, in the canonical
 *    display timezone (UTC — matches the day-bucketing already used elsewhere,
 *    e.g. the pipeline activity chart). Kept as one constant so two viewers never
 *    see different week boundaries.
 *  - this_month / last_month: calendar months, same timezone.
 *  - 7d / 24h: rolling windows ending now.
 *  - any: no lower bound.
 */
export type DateWindow = { since?: string; from?: string; to?: string };

export type WindowKind = 'calendar-week' | 'calendar-month' | 'rolling' | 'none';

export type ResolvedWindow = {
  start?: Date;
  end?: Date;
  kind: WindowKind;
  /** True when the selected calendar period hasn't finished yet (this week/month). */
  partial: boolean;
};

// Lead pipeline tracking began when Gmail ingest went live (see metrics/shared.tsx
// PIPELINE_TRACKING_START for the display string) — no comparison period may reach
// before this instant, or the baseline would be truncated and misleading.
export const TRACKING_START_DATE = new Date('2026-06-15T00:00:00.000Z');

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday 00:00 UTC of the week containing `d`. */
function mondayStartUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = startOfUTCDay(d);
  start.setUTCDate(start.getUTCDate() + diffToMonday);
  return start;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function monthStartUTC(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

/** Resolve a preset token or custom from/to into concrete start/end bounds. */
export function resolveWindow(w: DateWindow, now: Date = new Date()): ResolvedWindow {
  if (w.from || w.to) {
    const start = w.from ? new Date(`${w.from}T00:00:00.000Z`) : undefined;
    const end = w.to ? new Date(`${w.to}T23:59:59.999Z`) : undefined;
    return { start, end, kind: 'rolling', partial: false };
  }

  switch (w.since) {
    case 'this_week':
    case 'last_week': {
      const thisWeekStart = mondayStartUTC(now);
      const start = w.since === 'this_week' ? thisWeekStart : addDays(thisWeekStart, -7);
      const end = new Date(addDays(start, 7).getTime() - 1);
      return { start, end, kind: 'calendar-week', partial: end.getTime() > now.getTime() };
    }
    case 'this_month':
    case 'last_month': {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const start = w.since === 'this_month' ? monthStartUTC(y, m) : monthStartUTC(y, m - 1);
      const end = new Date(
        (w.since === 'this_month' ? monthStartUTC(y, m + 1) : monthStartUTC(y, m)).getTime() - 1,
      );
      return { start, end, kind: 'calendar-month', partial: end.getTime() > now.getTime() };
    }
    case '7d':
    case '24h': {
      const ms = w.since === '7d' ? 7 * MS_DAY : MS_DAY;
      return { start: new Date(now.getTime() - ms), end: now, kind: 'rolling', partial: false };
    }
    default:
      return { kind: 'none', partial: false };
  }
}

/**
 * Derive the immediately-preceding comparison period for a resolved window, per
 * the single generic rule: calendar presets compare to the previous calendar unit
 * of the same type; rolling/custom windows compare to the equal-length window
 * immediately before. Returns null when there's no comparison concept (any time).
 */
export function comparisonWindow(resolved: ResolvedWindow): { start: Date; end: Date } | null {
  if (resolved.kind === 'none' || !resolved.start || !resolved.end) return null;

  if (resolved.kind === 'calendar-week') {
    return { start: addDays(resolved.start, -7), end: addDays(resolved.end, -7) };
  }

  if (resolved.kind === 'calendar-month') {
    const y = resolved.start.getUTCFullYear();
    const m = resolved.start.getUTCMonth();
    return { start: monthStartUTC(y, m - 1), end: new Date(monthStartUTC(y, m).getTime() - 1) };
  }

  // rolling (including custom ranges): the window of identical length immediately before.
  const spanMs = resolved.end.getTime() - resolved.start.getTime();
  const end = new Date(resolved.start.getTime() - 1);
  const start = new Date(end.getTime() - spanMs);
  return { start, end };
}

/** Build a Prisma `createdAt` range filter, or undefined when no window is set. */
export function buildCreatedAtRange(w: DateWindow): { gte?: Date; lte?: Date } | undefined {
  const r = resolveWindow(w);
  if (!r.start && !r.end) return undefined;
  return { ...(r.start ? { gte: r.start } : {}), ...(r.end ? { lte: r.end } : {}) };
}
