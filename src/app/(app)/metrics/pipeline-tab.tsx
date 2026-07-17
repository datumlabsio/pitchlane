import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DateWindow } from '@/lib/date-window';
import {
  getLatencyMetrics,
  getPipelineActivitySeries,
  getPipelineFunnel,
  getPipelineHeroMetrics,
  getStatusBreakdown,
} from '@/domain/metrics/repository';
import { HeroMetricDeltaLine } from '@/components/metrics/hero-metric-delta';

import { PipelineActivityChart, PipelineFunnel, StatusBreakdown } from './metrics-charts';
import { formatDuration } from './shared';

export async function PipelineTab({ dateWindow, accountId }: { dateWindow: DateWindow; accountId?: string }) {
  const [metrics, funnel, statusBreakdown, latency, pipelineActivity] = await Promise.all([
    getPipelineHeroMetrics(dateWindow, accountId),
    getPipelineFunnel(dateWindow, accountId),
    getStatusBreakdown(dateWindow, accountId),
    getLatencyMetrics(dateWindow, accountId),
    getPipelineActivitySeries(dateWindow, accountId),
  ]);

  return (
    <div className="space-y-8">
      {/* ── Metric cards ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-300 to-orange-400" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
              <HeroMetricDeltaLine delta={metric.delta} />
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ── Funnel + Status ── */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline funnel</CardTitle>
            <p className="text-sm text-muted-foreground">How leads move from inbox to won contract.</p>
          </CardHeader>
          <CardContent>
            <PipelineFunnel data={funnel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">Live status distribution across all leads.</p>
          </CardHeader>
          <CardContent>
            <StatusBreakdown data={statusBreakdown} />
          </CardContent>
        </Card>
      </section>

      {/* ── Pipeline activity over time ── */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline activity over time</CardTitle>
          <p className="text-sm text-muted-foreground">
            What the team did each period (Monday-start weeks): leads received by arrival date and applications
            sent by the date they were applied. Pure activity — conversion is covered by the funnel above.
          </p>
        </CardHeader>
        <CardContent>
          {pipelineActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pipeline activity in this range.</p>
          ) : (
            <PipelineActivityChart data={pipelineActivity} />
          )}
        </CardContent>
      </Card>

      {/* ── Latency ── */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline latency</CardTitle>
          <p className="text-sm text-muted-foreground">
            Median time between stages, from lead timestamps and status-change history. “n of N” is how many of the
            leads that reached a stage had a usable timestamp — the rest are missing a recorded date.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Lead → applied', stat: latency.response, reachedNoun: 'applied', missingNoun: 'an applied date' },
              { label: 'Applied → reply', stat: latency.applyToReply, reachedNoun: 'replied', missingNoun: 'a reply date' },
              { label: 'Reply → call', stat: latency.replyToCall, reachedNoun: 'booked a call', missingNoun: 'a call date' },
            ].map(({ label, stat, reachedNoun, missingNoun }) => {
              const missing = stat.reached - stat.n;
              return (
                <div key={label} className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{formatDuration(stat.p50Ms)}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    median · {stat.n} of {stat.reached} {reachedNoun}
                  </p>
                  {missing > 0 && <p className="mt-0.5 text-xs text-amber-700">{missing} missing {missingNoun}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
