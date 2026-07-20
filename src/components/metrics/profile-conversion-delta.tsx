import { TableMetricDeltaLine } from '@/components/metrics/table-metric-delta';
import type { ProfileConversionMetricDelta } from '@/domain/metrics/repository';

export function ProfileConversionDeltaLine({ delta }: { delta: ProfileConversionMetricDelta }) {
  return <TableMetricDeltaLine delta={delta} />;
}
