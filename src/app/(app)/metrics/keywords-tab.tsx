import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DateWindow } from '@/lib/date-window';
import { getKeywordQualification } from '@/domain/metrics/repository';

import { KeywordChart } from './metrics-charts';
import { RateCell } from './shared';

export async function KeywordsTab({ dateWindow, accountId }: { dateWindow: DateWindow; accountId?: string }) {
  const { rows, totalLeads, leadsWithKeywords } = await getKeywordQualification(dateWindow, accountId);
  const coverage = totalLeads > 0 ? Math.round((leadsWithKeywords / totalLeads) * 100) : 0;

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Qualification rate by keyword</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No matched keywords in this range yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-2.5 text-xs text-stone-600">
        Based on each lead’s matched keywords from scoring. A lead can match several keywords, so mentions total
        more than leads. Coverage: <span className="font-semibold">{leadsWithKeywords}</span> of {totalLeads} leads
        ({coverage}%) had a matched keyword — the rest aren’t represented here.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top keywords — qualified vs noise</CardTitle>
          <p className="text-sm text-muted-foreground">
            Top 12 by volume. Green is qualified; grey is matched-but-not-qualified. Long grey bars = noisy words to
            tune out of your alerts.
          </p>
        </CardHeader>
        <CardContent>
          <KeywordChart data={rows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qualification rate by keyword</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sorted by volume. High matches + low qual % = a keyword bringing noise; trim it from the alert words.
          </p>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-stone-50/60">
                <TableHead>Keyword</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="text-right">Qualified</TableHead>
                <TableHead className="text-right">Qual %</TableHead>
                <TableHead className="text-right">Applied</TableHead>
                <TableHead className="text-right">Apply %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.keyword}>
                  <TableCell className="font-medium">{r.keyword}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.matched}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.qualified}</TableCell>
                  <TableCell className="text-right"><RateCell value={r.qualRate} /></TableCell>
                  <TableCell className="text-right tabular-nums">{r.applied}</TableCell>
                  <TableCell className="text-right"><RateCell value={r.applyRate} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
