import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DateWindow } from '@/lib/date-window';
import { COST_PER_CONNECT, getProfilePerformanceRows } from '@/domain/metrics/repository';

import { usd } from './shared';

export async function CostingTab({ dateWindow, accountId }: { dateWindow: DateWindow; accountId?: string }) {
  const profileRows = await getProfilePerformanceRows(dateWindow, accountId);

  const totals = profileRows.reduce(
    (acc, r) => ({
      applied: acc.applied + r.applied,
      replied: acc.replied + r.replied,
      callBooked: acc.callBooked + r.callBooked,
      won: acc.won + r.won,
      connects: acc.connects + r.connects,
      spend: acc.spend + r.spend,
    }),
    { applied: 0, replied: 0, callBooked: 0, won: 0, connects: 0, spend: 0 },
  );
  const blendedCostPerReply = totals.replied > 0 ? totals.spend / totals.replied : null;
  const blendedCostPerCall = totals.callBooked > 0 ? totals.spend / totals.callBooked : null;
  const blendedCostPerWin = totals.won > 0 ? totals.spend / totals.won : null;

  return (
    <div className="space-y-8">
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
    </div>
  );
}
