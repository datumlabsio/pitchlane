export const dynamic = 'force-dynamic';

import { Topbar } from '@/components/layout/topbar';
import { getLeadDetail, listLeadSummaries } from '@/domain/leads/repository';
import { listActiveAccounts } from '@/domain/accounts/repository';
import { env } from '@/lib/env';
import { LeadWorkbench } from './lead-workbench';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const [resolvedSp, accounts] = await Promise.all([searchParams, listActiveAccounts()]);

  function sp(key: string) {
    const v = resolvedSp[key];
    return typeof v === 'string' ? v : undefined;
  }

  const page = Math.max(1, parseInt(sp('page') ?? '1', 10) || 1);
  const accountId = sp('accountId');
  const status = sp('status');
  const search = sp('search');
  const selectedLeadId = sp('leadId') ?? null;

  const [leadsData, selectedLead] = await Promise.all([
    listLeadSummaries({ page, accountId, status, search }),
    selectedLeadId ? getLeadDetail(selectedLeadId) : null,
  ]);

  const labels = accounts.map((a) => a.gmailLabel);

  return (
    <div className="space-y-6">
      <Topbar
        title="Lead inbox"
        subtitle="All leads from forwarded Upwork emails, scored and ranked by profile rules."
      />
      <LeadWorkbench
        leads={leadsData.items}
        total={leadsData.total}
        page={leadsData.page}
        totalPages={leadsData.totalPages}
        selectedLead={selectedLead}
        selectedLeadId={selectedLeadId}
        labels={labels}
        accounts={accounts.map((a) => ({ id: a.id, personName: a.personName, gmailLabel: a.gmailLabel }))}
        currentFilters={{ accountId, status, search }}
        enrichmentEnabled={env.LEAD_ENRICHMENT_ENABLED === 'true'}
      />
    </div>
  );
}
