import { cn } from '@/lib/utils';
import type { ProfileVisibilityMetricDelta } from '@/domain/profile-stats/types';

export function ProfileVisibilityDeltaLine({ delta }: { delta: ProfileVisibilityMetricDelta }) {
  if (delta.kind === 'hidden') return null;
  if (delta.kind === 'no-data' || delta.kind === 'na') {
    return <p className="mt-0.5 text-xs text-stone-400">{delta.kind === 'no-data' ? 'no data' : 'n/a'}</p>;
  }

  const color =
    delta.direction === 'flat'
      ? 'text-stone-400'
      : delta.direction === 'up'
        ? 'text-emerald-700'
        : 'text-red-700';
  const arrow = delta.direction === 'flat' ? '→' : delta.direction === 'up' ? '↑' : '↓';
  const abs =
    delta.direction === 'down' && delta.currentValue === 0
      ? delta.previous
      : Math.abs(delta.absDelta);
  const pct = delta.pctDelta === null ? '' : ` (${delta.pctDelta > 0 ? '+' : ''}${delta.pctDelta}%)`;

  return (
    <p className={cn('mt-0.5 text-xs', color)}>
      vs {delta.previous} · {arrow} {abs}
      {pct}
    </p>
  );
}
