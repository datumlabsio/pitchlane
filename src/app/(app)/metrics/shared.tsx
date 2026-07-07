// Shared helpers used across the Metrics tab components.

// Lead/application (pipeline) tracking began when Gmail ingest went live. Anything
// before this has no funnel/costing/latency data. Profile-visibility stats are
// backfilled earlier.
export const PIPELINE_TRACKING_START = 'June 15, 2026';

export const usd = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Milliseconds → compact human duration (e.g. "45m", "2.3h", "1.4d"). Null → "n/a".
export function formatDuration(ms: number | null): string {
  if (ms == null) return 'n/a';
  const mins = ms / 60000;
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function RateCell({ value }: { value: number }) {
  const color = value >= 60 ? 'text-emerald-700' : value >= 30 ? 'text-amber-700' : 'text-stone-500';
  return <span className={`tabular-nums font-medium ${color}`}>{value}%</span>;
}
