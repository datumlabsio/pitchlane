import { cn } from '@/lib/utils';
import type { HeroMetricDelta } from '@/domain/metrics/repository';

export function HeroMetricDeltaLine({ delta }: { delta: HeroMetricDelta }) {
  if (delta.kind === 'hidden') return null;
  if (delta.kind === 'no-prior-data') {
    return <p className="mt-1.5 text-xs text-stone-400">no prior data</p>;
  }

  const color =
    delta.kind === 'n-too-small'
      ? 'text-stone-400'
      : delta.direction === 'up'
        ? 'text-emerald-700'
        : delta.direction === 'down'
          ? 'text-red-700'
          : 'text-stone-500';
  const arrow = delta.kind !== 'n-too-small' && delta.direction !== 'flat' ? (delta.direction === 'up' ? '↑' : '↓') : '→';

  if (delta.kind === 'count') {
    const pct = delta.pctDelta === null ? '' : ` (${delta.pctDelta > 0 ? '+' : ''}${delta.pctDelta}%)`;
    return (
      <p className={cn('mt-1.5 text-xs', color)}>
        vs {delta.previous} · {arrow} {Math.abs(delta.absDelta)}
        {pct}
      </p>
    );
  }

  if (delta.kind === 'pp') {
    return (
      <p className={cn('mt-1.5 text-xs', color)}>
        vs {delta.previous}% · {arrow} {Math.abs(delta.ppDelta)}pp
      </p>
    );
  }

  return <p className={cn('mt-1.5 text-xs', color)}>n too small</p>;
}
