import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DateWindow } from '@/lib/date-window';
import type { HeroMetricDelta, LatencyComparisonDelta, LeadAppliedLatencyStat } from '@/domain/metrics/repository';
import {
  getLatencyMetrics,
  getPipelineActivitySeries,
  getPipelineFunnel,
  getPipelineHeroMetrics,
  getSlaSeries,
  getStatusBreakdown,
  SLA_TARGET_HOURS,
} from '@/domain/metrics/repository';
import { HeroMetricDeltaLine } from '@/components/metrics/hero-metric-delta';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { LatencyHistogramChart, PipelineActivityChart, PipelineFunnel, SlaTrendChart, StatusBreakdown } from './metrics-charts';
import { formatDuration } from './shared';

function CoverageCaption({ stat }: { stat: LeadAppliedLatencyStat }) {
  const coveragePct = stat.reached === 0 ? 0 : Math.round((stat.n / stat.reached) * 100);
  const lowCoverage = stat.reached > 0 && coveragePct < 70;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="text-xs text-stone-400">
        {stat.n} of {stat.reached} applied · {stat.missingAppliedDate} missing an applied date
        {stat.excludedCount > 0 ? ` · ${stat.excludedCount} outside 0–72h` : ''}
      </p>
      {lowCoverage && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
          {coveragePct}% coverage
        </span>
      )}
    </div>
  );
}

function DeltaNote({ delta, invert = false }: { delta: HeroMetricDelta | LatencyComparisonDelta; invert?: boolean }) {
  if (delta.kind === 'hidden') return null;
  if (delta.kind === 'no-prior-data') return <p className="mt-1 text-xs text-stone-400">no prior data</p>;
  if (delta.kind === 'n-too-small') {
    return (
      <Tooltip>
        <TooltipTrigger className="mt-1 inline-block cursor-help text-xs text-stone-400">n too small</TooltipTrigger>
        <TooltipContent>Delta hidden when either window has fewer than 5 valid rows.</TooltipContent>
      </Tooltip>
    );
  }

  if (delta.kind === 'pp') {
    const color = delta.direction === 'up' ? 'text-emerald-700' : delta.direction === 'down' ? 'text-red-700' : 'text-stone-500';
    const arrow = delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→';
    return (
      <p className={`mt-1 text-xs ${color}`}>
        vs {delta.previous}% · {arrow} {Math.abs(delta.ppDelta)}pp
      </p>
    );
  }

  if (delta.kind === 'duration') {
    const betterIsDown = invert;
    const color =
      delta.direction === 'flat'
        ? 'text-stone-500'
        : betterIsDown
          ? delta.direction === 'up'
            ? 'text-emerald-700'
            : 'text-red-700'
          : delta.direction === 'up'
            ? 'text-red-700'
            : 'text-emerald-700';
    const arrow = delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→';
    return (
      <p className={`mt-1 text-xs ${color}`}>
        vs {formatDuration(delta.previousMs)} · {arrow} {formatDuration(Math.abs(delta.deltaMs))}
      </p>
    );
  }

  return null;
}

function CombinedMetric({ label, value, delta, invert = false }: { label: string; value: string; delta: HeroMetricDelta | LatencyComparisonDelta; invert?: boolean }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-3 py-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <DeltaNote delta={delta} invert={invert} />
    </div>
  );
}

export async function PipelineTab({ dateWindow, accountId }: { dateWindow: DateWindow; accountId?: string }) {
  const [metrics, funnel, statusBreakdown, latency, slaDaily, slaWeekly, slaMonthly, pipelineActivity] = await Promise.all([
    getPipelineHeroMetrics(dateWindow, accountId),
    getPipelineFunnel(dateWindow, accountId),
    getStatusBreakdown(dateWindow, accountId),
    getLatencyMetrics(dateWindow, accountId),
    getSlaSeries(dateWindow, accountId, 'daily'),
    getSlaSeries(dateWindow, accountId, 'weekly'),
    getSlaSeries(dateWindow, accountId, 'monthly'),
    getPipelineActivitySeries(dateWindow, accountId),
  ]);

  const { response, withinSla } = latency;

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

      {/* ── Lead → applied latency (PRD v1.1) ── */}
      <section className="space-y-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-300 to-blue-400" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Latency: posting → first application
              <Tooltip>
                <TooltipTrigger className="cursor-help text-stone-400 hover:text-stone-600" aria-label="SLA info">
                  ⓘ
                </TooltipTrigger>
                <TooltipContent>
                  Provisional targets: within {SLA_TARGET_HOURS}h and {70}% trend line.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              How fast we apply after a job is posted. Within 3h is the target share; p50 is the median (half applied
              faster); p75 and p90 show the slow tail.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CombinedMetric label={`Within ${SLA_TARGET_HOURS}h`} value={`${withinSla.pct}%`} delta={withinSla.delta} />
              <CombinedMetric label="p50 (median)" value={formatDuration(response.p50Ms)} delta={latency.comparisons.p50.delta} invert />
              <CombinedMetric label="p75" value={formatDuration(response.p75Ms)} delta={latency.comparisons.p75.delta} invert />
              <CombinedMetric label="p90" value={formatDuration(response.p90Ms)} delta={latency.comparisons.p90.delta} invert />
            </div>
            <CoverageCaption stat={response} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How long after posting we applied</CardTitle>
            <p className="text-sm text-muted-foreground">
              Applications in the selected period, grouped by hours between the job being posted and our
              application. Left is fast, red is late.
            </p>
          </CardHeader>
          <CardContent>
            {response.n === 0 ? (
              <p className="text-sm text-muted-foreground">No valid apply latencies in this range.</p>
            ) : (
              <LatencyHistogramChart buckets={response.buckets} total={response.n} />
            )}
            <CoverageCaption stat={response} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Are we getting faster or slower</CardTitle>
            <p className="text-sm text-muted-foreground">Trend of within-{SLA_TARGET_HOURS}h share across selected granularity.</p>
          </CardHeader>
          <CardContent>
            <SlaTrendChart dataByGranularity={{ daily: slaDaily, weekly: slaWeekly, monthly: slaMonthly }} />
            <CoverageCaption stat={response} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
