import { cn } from '@/lib/utils';

type Direction = 'up' | 'down' | 'flat';

export type TableMetricDelta =
  | { kind: 'hidden' }
  | { kind: 'no-prior-data' }
  | { kind: 'no-data' }
  | { kind: 'na' }
  | {
      kind: 'count' | 'money';
      previous: number;
      currentValue: number;
      absDelta: number;
      direction: Direction;
    };

function usd(n: number) {
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compact stacked delta for table cells (PRD decision 4 — no % bracket, 11px). */
export function TableMetricDeltaLine({ delta }: { delta: TableMetricDelta }) {
  if (delta.kind === 'hidden') return null;
  if (delta.kind === 'no-prior-data') {
    return <p className="mt-0.5 text-[11px] text-stone-400">no prior data</p>;
  }
  if (delta.kind === 'no-data') {
    return <p className="mt-0.5 text-[11px] text-stone-400">no data</p>;
  }
  if (delta.kind === 'na') {
    return <p className="mt-0.5 text-[11px] text-stone-400">n/a</p>;
  }

  const color =
    delta.direction === 'flat'
      ? 'text-stone-400'
      : delta.direction === 'up'
        ? 'text-emerald-700'
        : 'text-red-700';
  const arrow = delta.direction === 'flat' ? '→' : delta.direction === 'up' ? '↑' : '↓';
  const money = delta.kind === 'money';
  const absRaw =
    delta.direction === 'down' && delta.currentValue === 0 ? delta.previous : Math.abs(delta.absDelta);
  const abs = money ? usd(absRaw) : String(absRaw);
  const prev = money ? usd(delta.previous) : String(delta.previous);

  return (
    <p className={cn('mt-0.5 text-[11px]', color)}>
      vs {prev} · {arrow} {abs}
    </p>
  );
}
