import { TableMetricDeltaLine } from '@/components/metrics/table-metric-delta';
import type { ProfileVisibilityMetricDelta } from '@/domain/profile-stats/types';

export function ProfileVisibilityDeltaLine({ delta }: { delta: ProfileVisibilityMetricDelta }) {
  return <TableMetricDeltaLine delta={delta} />;
}
