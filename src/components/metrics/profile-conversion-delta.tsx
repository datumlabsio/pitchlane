import { cn } from '@/lib/utils';
import type { ProfileConversionMetricDelta } from '@/domain/metrics/repository';

function usd(n: number) {
  return (
    '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function ProfileConversionDeltaLine({ delta }: { delta: ProfileConversionMetricDelta }) {
  if (delta.kind === 'hidden') return null;
  if (delta.kind === 'no-prior-data') {
    return <p className="mt-0.5 text-xs text-stone-400">no prior data</p>;
  }
  if (delta.kind === 'na') {
    return <p className="mt-0.5 text-xs text-stone-400">n/a</p>;
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
    delta.direction === 'down' && delta.currentValue === 0
      ? delta.previous
      : Math.abs(delta.absDelta);
  const abs = money ? usd(absRaw) : String(absRaw);
  const prev = money ? usd(delta.previous) : String(delta.previous);
  const pct = delta.pctDelta === null ? '' : ` (${delta.pctDelta > 0 ? '+' : ''}${delta.pctDelta}%)`;

  return (
    <p className={cn('mt-0.5 text-xs', color)}>
      vs {prev} · {arrow} {abs}
      {pct}
    </p>
  );
}
