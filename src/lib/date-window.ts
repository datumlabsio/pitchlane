/**
 * Shared date-range filtering used by the leads list and the metrics/dashboard
 * aggregates. A custom from/to range takes precedence over a preset window.
 */
export type DateWindow = { since?: string; from?: string; to?: string };

// Preset filter tokens → lookback window in ms.
export const SINCE_WINDOWS_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

/** Build a Prisma `createdAt` range filter, or undefined when no window is set. */
export function buildCreatedAtRange(w: DateWindow): { gte?: Date; lte?: Date } | undefined {
  if (w.from || w.to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (w.from) range.gte = new Date(`${w.from}T00:00:00.000`);
    if (w.to) range.lte = new Date(`${w.to}T23:59:59.999`);
    return range;
  }
  const ms = w.since ? SINCE_WINDOWS_MS[w.since] : undefined;
  return ms ? { gte: new Date(Date.now() - ms) } : undefined;
}
