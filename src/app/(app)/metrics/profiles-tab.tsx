import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProfileConversionDeltaLine } from '@/components/metrics/profile-conversion-delta';
import { ProfileVisibilityDeltaLine } from '@/components/metrics/profile-visibility-delta';
import type { DateWindow } from '@/lib/date-window';
import { getProfileConversionTable, getProfilePerformanceRows } from '@/domain/metrics/repository';
import type { ProfileConversionCell } from '@/domain/metrics/repository';
import { getProfileVisibilityTable, getVisibilitySeries } from '@/domain/profile-stats/repository';
import type { ProfileVisibilityCell } from '@/domain/profile-stats/types';

import { ProfileBarChart, VisibilityChart } from './metrics-charts';
import { usd } from './shared';

function VisibilityMetricCell({ cell, bold = false }: { cell: ProfileVisibilityCell; bold?: boolean }) {
  return (
    <div className="text-right">
      <p className={bold ? 'font-bold tabular-nums' : 'tabular-nums'}>{cell.value}</p>
      <ProfileVisibilityDeltaLine delta={cell.delta} />
    </div>
  );
}

function ConversionMetricCell({
  cell,
  bold = false,
  money = false,
}: {
  cell: ProfileConversionCell;
  bold?: boolean;
  money?: boolean;
}) {
  return (
    <div className="text-right">
      <p className={bold ? 'font-bold tabular-nums' : 'tabular-nums'}>
        {money ? usd(cell.value) : cell.value}
      </p>
      <ProfileConversionDeltaLine delta={cell.delta} />
    </div>
  );
}

/** Fixed lookback for the visibility trend chart — independent of the page date filter. */
function lastThreeMonthsWindow(now = new Date()): DateWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate()));
  return { from: start.toISOString().slice(0, 10) };
}

export async function ProfilesTab({ dateWindow, accountId }: { dateWindow: DateWindow; accountId?: string }) {
  const visibilityWindow = lastThreeMonthsWindow();
  const [profileRows, conversionTable, visibility, visibilityTable] = await Promise.all([
    getProfilePerformanceRows(dateWindow, accountId),
    getProfileConversionTable(dateWindow, accountId),
    getVisibilitySeries(visibilityWindow, accountId),
    getProfileVisibilityTable(dateWindow, accountId),
  ]);

  return (
    <div className="space-y-8">
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

      {/* ── Profile conversion breakdown ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Profile conversion breakdown</CardTitle>
          <p className="shrink-0 text-xs text-muted-foreground">{conversionTable.comparisonLabel}</p>
        </CardHeader>
        <CardContent>
          {conversionTable.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles found.</p>
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Profile</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Qualified</TableHead>
                  <TableHead className="text-right">Applied</TableHead>
                  <TableHead className="text-right">Proposal viewed</TableHead>
                  <TableHead className="text-right">BU reviewed</TableHead>
                  <TableHead className="text-right">Replied</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Connects</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversionTable.rows.map((row) => (
                  <TableRow key={row.accountId ?? row.profile}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/leads?accountId=${row.accountId}`}
                        className="text-stone-900 underline-offset-2 hover:text-amber-700 hover:underline"
                      >
                        {row.profile}
                      </Link>
                    </TableCell>
                    <TableCell><ConversionMetricCell cell={row.leads} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.qualified} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.applied} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.proposalViewed} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.buReviewed} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.replied} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.calls} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.won} /></TableCell>
                    <TableCell><ConversionMetricCell cell={row.connects} /></TableCell>
                    <TableCell><ConversionMetricCell money cell={row.spend} /></TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-stone-200 bg-stone-50/60 font-bold">
                  <TableCell className="font-bold">{conversionTable.total.profile}</TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.leads} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.qualified} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.applied} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.proposalViewed} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.buReviewed} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.replied} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.calls} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.won} /></TableCell>
                  <TableCell><ConversionMetricCell bold cell={conversionTable.total.connects} /></TableCell>
                  <TableCell><ConversionMetricCell bold money cell={conversionTable.total.spend} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Profile visibility table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Profile visibility</CardTitle>
          <p className="shrink-0 text-xs text-muted-foreground">{visibilityTable.comparisonLabel}</p>
        </CardHeader>
        <CardContent>
          {visibilityTable.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No profiles found. Add weekly numbers under Profiles → Stats.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50/60">
                  <TableHead>Profile</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Invites</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibilityTable.rows.map((row) => (
                  <TableRow key={row.accountId ?? row.profile}>
                    <TableCell className="font-medium">{row.profile}</TableCell>
                    <TableCell><VisibilityMetricCell cell={row.views} /></TableCell>
                    <TableCell><VisibilityMetricCell cell={row.invites} /></TableCell>
                    <TableCell><VisibilityMetricCell cell={row.impressions} /></TableCell>
                    <TableCell><VisibilityMetricCell cell={row.clicks} /></TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-stone-200 bg-stone-50/60 font-bold">
                  <TableCell className="font-bold">{visibilityTable.total.profile}</TableCell>
                  <TableCell><VisibilityMetricCell bold cell={visibilityTable.total.views} /></TableCell>
                  <TableCell><VisibilityMetricCell bold cell={visibilityTable.total.invites} /></TableCell>
                  <TableCell><VisibilityMetricCell bold cell={visibilityTable.total.impressions} /></TableCell>
                  <TableCell><VisibilityMetricCell bold cell={visibilityTable.total.clicks} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Profile visibility over time (always last 3 months) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Profile visibility over time</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last 3 months of weekly Upwork views, invites, impressions, and clicks, summed across the selected
            profiles. Entered manually per profile under Profiles → Stats.
          </p>
        </CardHeader>
        <CardContent>
          {visibility.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stats in the last 3 months yet. Add weekly numbers under Profiles → Stats.
            </p>
          ) : (
            <VisibilityChart data={visibility} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
