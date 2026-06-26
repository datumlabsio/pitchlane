export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Topbar } from '@/components/layout/topbar';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { MultiSelectFilter } from '@/components/filters/multi-select';
import { listActiveAccounts } from '@/domain/accounts/repository';
import {
  getDashboardMetrics,
  getPipelineFunnel,
  getProfilePerformanceRows,
  getStatusBreakdown,
} from '@/domain/metrics/repository';

import { PipelineFunnel, ProfileBarChart, StatusBreakdown } from './metrics-charts';

function RateCell({ value }: { value: number }) {
  const color = value >= 60 ? 'text-emerald-700' : value >= 30 ? 'text-amber-700' : 'text-stone-500';
  return <span className={`tabular-nums font-medium ${color}`}>{value}%</span>;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MetricsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const dateWindow = { since: str('since'), from: str('from'), to: str('to') };
  const accountId = str('accountId'); // comma-separated profile filter (multi-select)

  const [accounts, metrics, funnel, profileRows, statusBreakdown] = await Promise.all([
    listActiveAccounts(),
    getDashboardMetrics(dateWindow, accountId),
    getPipelineFunnel(dateWindow, accountId),
    getProfilePerformanceRows(dateWindow, accountId),
    getStatusBreakdown(dateWindow, accountId),
  ]);

  const totals = profileRows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      qualified: acc.qualified + r.qualified,
      applied: acc.applied + r.applied,
      won: acc.won + r.won,
      connects: acc.connects + r.connects,
    }),
    { leads: 0, qualified: 0, applied: 0, won: 0, connects: 0 },
  );
  const totalQualRate = totals.leads > 0 ? Math.round((totals.qualified / totals.leads) * 100) : 0;
  const totalApplyRate = totals.qualified > 0 ? Math.round((totals.applied / totals.qualified) * 100) : 0;
  const totalWinRate = totals.applied > 0 ? Math.round((totals.won / totals.applied) * 100) : 0;

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
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Profile</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Qualified</TableHead>
                  <TableHead className="text-right">Qual %</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                  <TableHead className="text-right">Apply %</TableHead>
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
                    <TableCell className="text-right tabular-nums">{row.qualified}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.qualRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.applied}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.applyRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.won}</TableCell>
                    <TableCell className="text-right"><RateCell value={row.winRate} /></TableCell>
                    <TableCell className="text-right tabular-nums">{row.connects}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-stone-200 bg-stone-50/60 font-bold">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.leads}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.qualified}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalQualRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.applied}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalApplyRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.won}</TableCell>
                  <TableCell className="text-right"><RateCell value={totalWinRate} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{totals.connects}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
