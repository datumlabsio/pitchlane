export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getDashboardMetrics, getProfilePerformanceRows, getRecentQualifiedLeads } from '@/domain/metrics/repository';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const dateWindow = { since: str('since'), from: str('from'), to: str('to') };

  const [metrics, profileRows, needsReview] = await Promise.all([
    getDashboardMetrics(dateWindow),
    getProfilePerformanceRows(dateWindow),
    getRecentQualifiedLeads(dateWindow),
  ]);

  const totals = profileRows.reduce(
    (acc, row) => ({
      leads: acc.leads + row.leads,
      qualified: acc.qualified + row.qualified,
      applied: acc.applied + row.applied,
      connects: acc.connects + row.connects,
    }),
    { leads: 0, qualified: 0, applied: 0, connects: 0 },
  );

  return (
    <div className="space-y-8">
      <Topbar
        title="Dashboard"
        subtitle="Overview of lead activity across all profiles."
        actions={<DateRangeFilter />}
      />

      {/* Metric cards */}
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

      {/* Two-column section */}
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Needs review */}
        <Card>
          <CardHeader>
            <CardTitle>Needs review</CardTitle>
            <p className="text-sm text-muted-foreground">Recently qualified leads waiting for action.</p>
          </CardHeader>
          <CardContent>
            {needsReview.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads awaiting review.</p>
            ) : (
              <ul className="space-y-3">
                {needsReview.map((lead) => (
                  <li key={lead.id} className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/leads?leadId=${lead.id}`}
                        className="block truncate text-sm font-medium text-stone-900 hover:text-amber-700"
                      >
                        {lead.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="rounded-full bg-stone-100 text-stone-600 text-xs"
                        >
                          {lead.profileName}
                        </Badge>
                        {lead.status === 'QUALIFIED' ? (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"
                          >
                            Qualified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-stone-100 text-stone-600 text-xs"
                          >
                            New
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">Score: {lead.score}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <span className="text-xs text-stone-500">{lead.budget}</span>
                      <span className="text-xs text-stone-400">{lead.createdAt}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Profile funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Profile funnel</CardTitle>
            <p className="text-sm text-muted-foreground">Lead conversion by profile.</p>
          </CardHeader>
          <CardContent>
            {profileRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No profile data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Qualified</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    <TableHead className="text-right">Connects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profileRows.map((row) => (
                    <TableRow key={row.profile}>
                      <TableCell className="font-medium">{row.profile}</TableCell>
                      <TableCell className="text-right">{row.leads}</TableCell>
                      <TableCell className="text-right">{row.qualified}</TableCell>
                      <TableCell className="text-right">{row.applied}</TableCell>
                      <TableCell className="text-right">{row.connects}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-stone-300 font-bold">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{totals.leads}</TableCell>
                    <TableCell className="text-right font-bold">{totals.qualified}</TableCell>
                    <TableCell className="text-right font-bold">{totals.applied}</TableCell>
                    <TableCell className="text-right font-bold">{totals.connects}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
