import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DateWindow } from '@/lib/date-window';
import { getProfilePerformanceRows } from '@/domain/metrics/repository';
import { getVisibilitySeries } from '@/domain/profile-stats/repository';

import { ProfileBarChart, VisibilityChart } from './metrics-charts';
import { RateCell } from './shared';

export async function ProfilesTab({ dateWindow, accountId }: { dateWindow: DateWindow; accountId?: string }) {
  const [profileRows, visibility] = await Promise.all([
    getProfilePerformanceRows(dateWindow, accountId),
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
    }),
    { leads: 0, qualified: 0, applied: 0, replied: 0, callBooked: 0, won: 0, connects: 0 },
  );
  const totalQualRate = totals.leads > 0 ? Math.round((totals.qualified / totals.leads) * 100) : 0;
  const totalApplyRate = totals.qualified > 0 ? Math.round((totals.applied / totals.qualified) * 100) : 0;
  const totalReplyRate = totals.applied > 0 ? Math.round((totals.replied / totals.applied) * 100) : 0;
  const totalBookRate = totals.applied > 0 ? Math.round((totals.callBooked / totals.applied) * 100) : 0;
  const totalWinRate = totals.applied > 0 ? Math.round((totals.won / totals.applied) * 100) : 0;

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
