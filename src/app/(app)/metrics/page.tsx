export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/layout/topbar';
import { DateRangeFilter } from '@/components/filters/date-range-filter';
import { MultiSelectFilter } from '@/components/filters/multi-select';
import { listActiveAccounts } from '@/domain/accounts/repository';

import { CostingTab } from './costing-tab';
import { KeywordsTab } from './keywords-tab';
import { MetricsTabsNav } from './metrics-tabs-nav';
import { PipelineTab } from './pipeline-tab';
import { ProfilesTab } from './profiles-tab';
import { PIPELINE_TRACKING_START } from './shared';

const TABS = ['pipeline', 'profiles', 'costing', 'keywords'] as const;
type Tab = (typeof TABS)[number];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MetricsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const from = str('from');
  const to = str('to');
  // Default to "This week" on first load (zero-click WoW view); explicit `since`,
  // or a custom from/to range, always wins.
  const since = str('since') ?? (from || to ? undefined : 'this_week');
  const dateWindow = { since, from, to };
  const accountId = str('accountId'); // comma-separated profile filter (multi-select)
  const tabParam = str('tab');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'pipeline';

  const accounts = await listActiveAccounts();

  return (
    <div className="space-y-6">
      <Topbar
        title="Metrics"
        subtitle="Pipeline performance across all profiles — qualification, costing, latency, and keywords."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MultiSelectFilter
              param="accountId"
              label="Profiles"
              options={accounts.map((a) => ({ value: a.id, label: a.personName }))}
            />
            <DateRangeFilter defaultToken="this_week" />
          </div>
        }
      />

      {/* ── Tracking-window note (applies across tabs) ── */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900">
        Lead pipeline tracking began <span className="font-semibold">{PIPELINE_TRACKING_START}</span>. Funnel,
        costing, latency, and keywords cover that date onward — earlier periods have no data. Profile-visibility
        stats are backfilled to December 2025.
      </div>

      <MetricsTabsNav />

      {tab === 'pipeline' && <PipelineTab dateWindow={dateWindow} accountId={accountId} />}
      {tab === 'profiles' && <ProfilesTab dateWindow={dateWindow} accountId={accountId} />}
      {tab === 'costing' && <CostingTab dateWindow={dateWindow} accountId={accountId} />}
      {tab === 'keywords' && <KeywordsTab dateWindow={dateWindow} accountId={accountId} />}
    </div>
  );
}
