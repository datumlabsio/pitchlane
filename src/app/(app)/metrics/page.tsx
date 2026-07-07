export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Topbar } from '@/components/layout/topbar';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { MultiSelectFilter } from '@/components/filters/multi-select';
import { listActiveAccounts } from '@/domain/accounts/repository';
import {
  COST_PER_CONNECT,
  getDashboardMetrics,
  getLatencyMetrics,
  getPipelineFunnel,
  getProfilePerformanceRows,
  getStatusBreakdown,
} from '@/domain/metrics/repository';
import { getVisibilitySeries } from '@/domain/profile-stats/repository';

import { PipelineFunnel, ProfileBarChart, StatusBreakdown, VisibilityChart } from './metrics-charts';

function RateCell({ value }: { value: number }) {
  const color = value >= 60 ? 'text-emerald-700' : value >= 30 ? 'text-amber-700' : 'text-stone-500';
  return <span className={`tabular-nums font-medium ${color}`}>{value}%</span>;
}

const usd = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Milliseconds → compact human duration (e.g. "45m", "2.3h", "1.4d"). Null → "n/a".
function formatDuration(ms: number | null): string {
  if (ms == null) return 'n/a';
  const mins = ms / 60000;
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MetricsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const dateWindow = { since: str('since'), from: str('from'), to: str('to') };
  const accountId = str('accountId'); // comma-separated profile filter (multi-select)

  const [accounts, metrics, funnel, profileRows, statusBreakdown, latency, visibility] = await Promise.all([
    listActiveAccounts(),
    getDashboardMetrics(dateWindow, accountId),
    getPipelineFunnel(dateWindow, accountId),
    getProfilePerformanceRows(dateWindow, accountId),
    getStatusBreakdown(dateWindow, accountId),
    getLatencyMetrics(dateWindow, accountId),
    getVisibilitySeries(dateWindow, accountId),
  ]);

  const totals = profileRows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      qualified: acc.qualified + r.qualified,
      applied: acc.applied + r.applied,
      replied: acc.replied + r.replied,
      callBooked: acc.callBooked + r.callBooked,
      won: acc.won + r.won,
      connects: acc.connects + r.connects,
      spend: acc.spend + r.spend,
    }),
    { leads: 0, qualified: 0, applied: 0, replied: 0, callBooked: 0, won: 0, connects: 0, spend: 0 },
  );
  const totalQualRate = totals.leads > 0 ? Math.round((totals.qualified / totals.leads) * 100) : 0;
  const totalApplyRate = totals.qualified > 0 ? Math.round((totals.applied / totals.qualified) * 100) : 0;
  const totalReplyRate = totals.applied > 0 ? Math.round((totals.replied / totals.applied) * 100) : 0;
  const totalBookRate = totals.applied > 0 ? Math.round((totals.callBooked / totals.applied) * 100) : 0;
  const totalWinRate = totals.applied > 0 ? Math.round((totals.won / totals.applied) * 100) : 0;

  // Blended connect economics across the filtered profiles.
  const blendedCostPerReply = totals.replied > 0 ? totals.spend / totals.replied : null;
  const blendedCostPerCall = totals.callBooked > 0 ? totals.spend / totals.callBooked : null;
  const blendedCostPerWin = totals.won > 0 ? totals.spend / totals.won : null;

  return (
    <div className="space-y-8">
      <Topbar
        title="Metrics"
        subtitle="Pipeline performance across all profiles — qualification rates, application tracking, and win rate."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              param="accountId"
              label="Profiles"
              options={accounts.map((a) => ({ value: a.id, label: a.personName }))}
            />
            <DateRangeFilter />
          </div>
        }
      />

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

      {/* ── Profile bar chart ── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile volume</CardTitle>
          <p className="text-sm text-muted-foreground">Leads received, qualified, and applied per profile.</p>
        </CardHeader>
        <CardContent>
          {profileRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles found.</p>
          ) : (
            <ProfileBarChart data={profileRows} />
          )}
        </CardContent>
      </Card>

      {/* ── Profile table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile conversion breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">Full funnel per profile with conversion rates at each stage.</p>
        </CardHeader>
        <CardContent>
          {profileRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles found.</p>
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Profile</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Qual %</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                  <TableHead className="text-right">Apply %</TableHead>
                  <TableHead className="text-right">Replied</TableHead>
                  <TableHead className="text-right">Reply %</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Book %</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Win %</TableHead>
                  <TableHead className="text-right">Connects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profileRows.map((row) => (
                  <TableRow key={row.profile}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/leads?accountId=${row.accountId}`}
                        className="text-stone-900 underline-offset-2 hover:text-amber-700 hover:underline"
                      >
                        {row.profile}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.qualRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.applied}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.applyRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.replied}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.replyRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.callBooked}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.bookRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.won}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.winRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.connects}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-stone-200 bg-stone-50/60 font-bold">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.leads}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalQualRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.applied}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalApplyRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.replied}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalReplyRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.callBooked}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalBookRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.won}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalWinRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.connects}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Costing ── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Connect spend', value: usd(totals.spend), note: `${totals.connects} connects at ${usd(COST_PER_CONNECT)}` },
          { label: 'Cost per reply', value: blendedCostPerReply != null ? usd(blendedCostPerReply) : 'n/a', note: 'Blended across profiles' },
          { label: 'Cost per call', value: blendedCostPerCall != null ? usd(blendedCostPerCall) : 'n/a', note: 'Blended across profiles' },
          { label: 'Cost per win', value: blendedCostPerWin != null ? usd(blendedCostPerWin) : 'n/a', note: 'Connect cost only, excludes revenue' },
        ].map((metric) => (
          <Card key={metric.label} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-300 to-blue-400" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.note}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Connect economics by profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Spend is connects × {usd(COST_PER_CONNECT)}. Connects are gross (they also cover boosting and the
            Available Badge), so cost-per-outcome overstates true proposal cost.
          </p>
        </CardHeader>
        <CardContent>
          {profileRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles found.</p>
          ) : (
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Profile</TableHead>
                  <TableHead className="text-right">Connects</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Connects / app</TableHead>
                  <TableHead className="text-right">Cost / reply</TableHead>
                  <TableHead className="text-right">Cost / call</TableHead>
                  <TableHead className="text-right">Cost / win</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profileRows.map((row) => (
                  <TableRow key={row.profile}>
                    <TableCell className="font-medium">{row.profile}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.connects}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(row.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.connectsPerApp.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.costPerReply != null ? usd(row.costPerReply) : 'n/a'}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.costPerCall != null ? usd(row.costPerCall) : 'n/a'}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.costPerWin != null ? usd(row.costPerWin) : 'no wins'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-stone-200 bg-stone-50/60 font-bold">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.connects}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{usd(totals.spend)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {totals.applied > 0 ? (totals.connects / totals.applied).toFixed(1) : '0.0'}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{blendedCostPerReply != null ? usd(blendedCostPerReply) : 'n/a'}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{blendedCostPerCall != null ? usd(blendedCostPerCall) : 'n/a'}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{blendedCostPerWin != null ? usd(blendedCostPerWin) : 'no wins'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Latency ── */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline latency</CardTitle>
          <p className="text-sm text-muted-foreground">
            Median time between stages, from lead timestamps and status-change history. Response is how fast we
            apply after a lead lands; the others are how fast the deal moves once applied.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Lead → applied', stat: latency.response },
              { label: 'Applied → reply', stat: latency.applyToReply },
              { label: 'Reply → call', stat: latency.replyToCall },
            ].map(({ label, stat }) => (
              <div key={label} className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{formatDuration(stat.p50Ms)}</p>
                <p className="mt-1 text-xs text-stone-400">median · {stat.n} lead{stat.n === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Profile visibility ── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile visibility over time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Weekly Upwork views, invites, impressions, and clicks, summed across the selected profiles. Entered
            manually per profile under Profiles → Stats.
          </p>
        </CardHeader>
        <CardContent>
          {visibility.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stats in this range yet. Add weekly numbers under Profiles → Stats.
            </p>
          ) : (
            <VisibilityChart data={visibility} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
