'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { ExternalLink, Plus, Search, X } from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  leadLifecycleStatuses,
  leadStatusLabelMap,
  type LeadDetail,
  type LeadSummary,
} from '@/domain/leads/types';
import { cn, formatPercent } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusBadgeVariant(statusCode: LeadSummary['statusCode']) {
  switch (statusCode) {
    case 'QUALIFIED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'REJECTED':
    case 'LOST':
    case 'QUALIFIED_LOST':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'APPLIED':
    case 'CLIENT_REPLIED':
    case 'INTRO_CALL':
    case 'FOLLOW_UP':
    case 'ONGOING_DISCUSSION':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'WON':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'HIRES_OTHER':
    case 'JOB_CLOSED':
    case 'CLOSED':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-stone-100 text-stone-600 border-stone-200';
  }
}

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

type FilterAccount = { id: string; personName: string; gmailLabel: string };
type CurrentFilters = { accountId?: string; status?: string; search?: string };

function FilterBar({
  accounts,
  currentFilters,
}: {
  accounts: FilterAccount[];
  currentFilters: CurrentFilters;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState<string>(currentFilters.search ?? '');
  const hasFilters = !!(currentFilters.accountId || currentFilters.status || currentFilters.search);

  function buildUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams();
    if (currentFilters.accountId) params.set('accountId', currentFilters.accountId);
    if (currentFilters.status) params.set('status', currentFilters.status);
    if (currentFilters.search) params.set('search', currentFilters.search);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    params.delete('page');
    params.delete('leadId');
    const qs = params.toString();
    return qs ? `/leads?${qs}` : '/leads';
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput || null }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={currentFilters.accountId ?? 'all'}
        onValueChange={(v: string | null) => router.push(buildUrl({ accountId: !v || v === 'all' ? null : v }))}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All profiles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All profiles</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.personName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentFilters.status ?? 'all'}
        onValueChange={(v: string | null) => router.push(buildUrl({ status: !v || v === 'all' ? null : v }))}
      >
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.entries(leadStatusLabelMap).map(([code, label]) => (
            <SelectItem key={code} value={code}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search titles…"
            className="h-8 w-52 rounded-md border border-stone-200 bg-white pl-8 pr-3 text-xs outline-none transition focus:border-stone-400 focus:ring-1 focus:ring-stone-300"
          />
        </div>
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              router.push(buildUrl({ search: null }));
            }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 hover:text-stone-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {hasFilters && (
        <Link
          href="/leads"
          className="text-xs text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function Pagination({
  page,
  totalPages,
  total,
  currentFilters,
}: {
  page: number;
  totalPages: number;
  total: number;
  currentFilters: CurrentFilters;
}) {
  function buildPageUrl(targetPage: number) {
    const params = new URLSearchParams();
    if (currentFilters.accountId) params.set('accountId', currentFilters.accountId);
    if (currentFilters.status) params.set('status', currentFilters.status);
    if (currentFilters.search) params.set('search', currentFilters.search);
    params.set('page', String(targetPage));
    return `/leads?${params.toString()}`;
  }

  if (totalPages <= 1 && total <= 20) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-1">
      <p className="text-xs text-stone-500">
        {total} lead{total !== 1 ? 's' : ''}{totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
      </p>
      {totalPages > 1 && (
        <div className="flex gap-1.5">
          <Link
            href={buildPageUrl(page - 1)}
            aria-disabled={page <= 1}
            className={cn(
              'rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400',
              page <= 1 && 'pointer-events-none opacity-40',
            )}
          >
            Previous
          </Link>
          <Link
            href={buildPageUrl(page + 1)}
            aria-disabled={page >= totalPages}
            className={cn(
              'rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400',
              page >= totalPages && 'pointer-events-none opacity-40',
            )}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual ingest dialog form
// ---------------------------------------------------------------------------

const DEFAULT_BODY =
  'We need a Power BI specialist with SQL and dashboard design experience to improve weekly executive reporting. Budget is $1,500 fixed.';

const LEAD_SOURCES = [
  { value: 'EMAIL_FORWARD', label: 'Email forward' },
  { value: 'INVITE', label: 'Invite (client-initiated)' },
  { value: 'MANUAL', label: 'Manual entry' },
] as const;

function ManualIngestDialogContent({
  labels,
  onSuccess,
}: {
  labels: string[];
  onSuccess: () => void;
}) {
  const [ingestStatus, setIngestStatus] = useState('');
  const [ingestPending, setIngestPending] = useState(false);
  const [gmailLabel, setGmailLabel] = useState(labels[0] ?? '');
  const [source, setSource] = useState<string>('EMAIL_FORWARD');
  const [sender, setSender] = useState('alerts@upwork.com');
  const [subject, setSubject] = useState('Power BI Dashboard Optimization for Executive Team');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sourceUrl, setSourceUrl] = useState('https://www.upwork.com/jobs/~manual-test-lead');
  const [budget, setBudget] = useState('$1,500 fixed');
  const [skills, setSkills] = useState('power bi, sql, dashboard');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIngestPending(true);
    setIngestStatus('');

    const payload = {
      gmailLabel,
      source,
      from: sender,
      subject,
      body,
      sourceUrl,
      extractedBudget: budget,
      extractedSkills: skills
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch('/api/ingest/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setIngestStatus(result.error ?? 'Ingestion failed.');
      } else {
        setIngestStatus(
          result.duplicate
            ? `Duplicate ignored for "${subject}".`
            : `Lead created with status ${result.status}.`,
        );
        onSuccess();
      }
    } catch (error) {
      setIngestStatus(error instanceof Error ? error.message : 'Unknown error.');
    } finally {
      setIngestPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ingest-label">Profile label</Label>
          <Select value={gmailLabel} onValueChange={(value: string | null) => setGmailLabel(value ?? '')}>
            <SelectTrigger id="ingest-label">
              <SelectValue placeholder="Select label" />
            </SelectTrigger>
            <SelectContent>
              {labels.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ingest-source">Source</Label>
          <Select value={source} onValueChange={(v: string | null) => setSource(v ?? 'EMAIL_FORWARD')}>
            <SelectTrigger id="ingest-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ingest-sender">Sender</Label>
          <Input
            id="ingest-sender"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ingest-budget">Budget</Label>
          <Input
            id="ingest-budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ingest-subject">Subject / Title</Label>
        <Input
          id="ingest-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ingest-body">Email body / Job description</Label>
        <Textarea
          id="ingest-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ingest-source-url">Source URL</Label>
          <Input
            id="ingest-source-url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ingest-skills">Skills (comma-separated)</Label>
          <Input
            id="ingest-skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="power bi, sql, dashboard"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1">
        <Button type="submit" disabled={ingestPending}>
          {ingestPending ? 'Submitting...' : 'Create lead'}
        </Button>
        {ingestStatus && (
          <p className="text-sm text-stone-500">{ingestStatus}</p>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LeadWorkbench({
  leads,
  total,
  page,
  totalPages,
  selectedLead,
  selectedLeadId,
  labels,
  accounts,
  currentFilters,
}: {
  leads: LeadSummary[];
  total: number;
  page: number;
  totalPages: number;
  selectedLead: LeadDetail | null;
  selectedLeadId: string | null;
  labels: string[];
  accounts: FilterAccount[];
  currentFilters: CurrentFilters;
}) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [proposalDraft, setProposalDraft] = useState('');
  const [connectsSpent, setConnectsSpent] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [lastFollowUpAt, setLastFollowUpAt] = useState('');
  const [notes, setNotes] = useState('');
  const [ingestOpen, setIngestOpen] = useState(false);

  useEffect(() => {
    setProposalDraft(selectedLead?.proposals[0]?.content ?? '');
    setConnectsSpent(selectedLead?.application?.connectsSpent?.toString() ?? '');
    setAppliedAt(formatDateTimeInput(selectedLead?.application?.appliedAt ?? null));
    setLastFollowUpAt(formatDateTimeInput(selectedLead?.application?.lastFollowUpAt ?? null));
    setNotes(selectedLead?.application?.notes ?? '');
    setStatusMessage('');
  }, [selectedLead]);

  async function runRequest(url: string, init: RequestInit, successMessage: string) {
    setStatusMessage('');
    startTransition(async () => {
      try {
        const response = await fetch(url, init);
        const result = await response.json();
        if (!response.ok || !result.ok) {
          setStatusMessage(result.error ?? 'Request failed.');
          return;
        }
        setStatusMessage(successMessage);
        router.refresh();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Unknown request error.');
      }
    });
  }

  function submitStatus(status: (typeof leadLifecycleStatuses)[number]) {
    if (!selectedLead) return;
    void runRequest(
      `/api/leads/${selectedLead.id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
      `Lead moved to ${leadStatusLabelMap[status]}.`,
    );
  }

  function submitApplication() {
    if (!selectedLead) return;
    const parsedConnects = connectsSpent.trim().length > 0 ? Number(connectsSpent) : null;
    if (parsedConnects !== null && (!Number.isInteger(parsedConnects) || parsedConnects < 0)) {
      setStatusMessage('Connects spent must be a non-negative integer.');
      return;
    }
    void runRequest(
      '/api/applications',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          connectsSpent: parsedConnects,
          appliedAt: appliedAt || null,
          lastFollowUpAt: lastFollowUpAt || null,
          notes,
        }),
      },
      'Application details saved.',
    );
  }

  function saveProposal(mode: 'edit' | 'regenerate') {
    if (!selectedLead) return;
    if (mode === 'edit' && proposalDraft.trim().length === 0) {
      setStatusMessage('Proposal content is required.');
      return;
    }
    void runRequest(
      `/api/leads/${selectedLead.id}/proposals`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'edit' ? { mode, content: proposalDraft } : { mode }),
      },
      mode === 'edit' ? 'Proposal version saved.' : 'Proposal regenerated.',
    );
  }

  function buildCloseUrl() {
    const params = new URLSearchParams();
    if (currentFilters.accountId) params.set('accountId', currentFilters.accountId);
    if (currentFilters.status) params.set('status', currentFilters.status);
    if (currentFilters.search) params.set('search', currentFilters.search);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/leads?${qs}` : '/leads';
  }

  return (
    <>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar accounts={accounts} currentFilters={currentFilters} />
        <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
          <DialogTrigger
            render={<Button size="sm" className="gap-1.5" />}
          >
            <Plus className="h-3.5 w-3.5" />
            Add lead
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add lead manually</DialogTitle>
            </DialogHeader>
            <ManualIngestDialogContent
              labels={labels}
              onSuccess={() => {
                setIngestOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50 hover:bg-stone-50">
              <TableHead className="w-[35%]">Title</TableHead>
              <TableHead>Profile</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-stone-500">
                  No leads found. Try adjusting your filters or add a new lead.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const isSelected = lead.id === selectedLeadId;
                return (
                  <TableRow
                    key={lead.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-amber-50/60',
                      isSelected && 'bg-amber-50',
                    )}
                    onClick={() => router.push(`/leads?leadId=${lead.id}`)}
                  >
                    <TableCell className="font-medium">
                      <span className="line-clamp-2 max-w-xs">{lead.title}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-stone-50 text-stone-700 border-stone-200 font-normal"
                      >
                        {lead.profileName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          statusBadgeVariant(lead.statusCode),
                        )}
                      >
                        {lead.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-stone-600">
                      {formatPercent(lead.matchScore)}
                    </TableCell>
                    <TableCell className="text-stone-600">{lead.budget}</TableCell>
                    <TableCell className="text-stone-500 text-xs">{relativeTime(lead.createdAt)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        currentFilters={currentFilters}
      />

      {/* Slide-over panel */}
      <Sheet
        open={selectedLead !== null}
        onOpenChange={(open) => {
          if (!open) router.push(buildCloseUrl());
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 flex flex-col">
          {selectedLead && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <SheetTitle className="text-base font-semibold leading-snug text-stone-950 line-clamp-2 pr-2">
                    {selectedLead.title}
                  </SheetTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      statusBadgeVariant(selectedLead.statusCode),
                    )}
                  >
                    {selectedLead.status}
                  </span>
                  <Badge variant="outline" className="bg-stone-50 text-stone-700 border-stone-200 font-normal">
                    {selectedLead.profileName}
                  </Badge>
                  <span className="text-xs text-stone-500">{selectedLead.budget}</span>
                  {selectedLead.sourceUrl && (
                    <a
                      href={selectedLead.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex items-center gap-1 rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400"
                    >
                      Open source
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </SheetHeader>

              <Separator />

              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-4">
                  <Tabs defaultValue="overview">
                    <TabsList className="mb-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="proposal">Proposal</TabsTrigger>
                      <TabsTrigger value="application">Application</TabsTrigger>
                      <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>

                    {/* ── Overview ── */}
                    <TabsContent value="overview" className="space-y-5 mt-0">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">Match</p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {formatPercent(selectedLead.matchScore)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">Confidence</p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {selectedLead.confidence}
                          </p>
                        </div>
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">Source</p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {selectedLead.sourceCompleteness}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Lead brief</p>
                        <p className="text-sm leading-6 text-stone-700">
                          {(selectedLead.emailSnippet || selectedLead.rawEmailBody || '').slice(0, 800) ||
                            'No lead copy captured.'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                          Evaluation notes
                        </p>
                        {selectedLead.summary.length > 0 ? (
                          <ul className="space-y-1.5">
                            {selectedLead.summary.map((item) => (
                              <li key={item} className="flex gap-2 text-sm leading-6 text-stone-700">
                                <span className="mt-0.5 text-stone-400">&#8212;</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-stone-500">No evaluation summary available.</p>
                        )}
                        {selectedLead.rejectionReasons.length > 0 && (
                          <div className="mt-2 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
                            <p className="text-xs font-medium text-rose-700">Rejected by rules</p>
                            <ul className="mt-1 space-y-0.5">
                              {selectedLead.rejectionReasons.map((r) => (
                                <li key={r} className="text-xs text-rose-600">{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedLead.matchedKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedLead.matchedKeywords.map((kw) => (
                              <span
                                key={kw}
                                className="inline-flex items-center rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs text-amber-800"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Lifecycle</p>
                        <div className="flex flex-wrap gap-2">
                          {leadLifecycleStatuses.map((status) => {
                            const isCurrent = selectedLead.statusCode === status;
                            return (
                              <button
                                key={status}
                                type="button"
                                disabled={isPending || isCurrent}
                                onClick={() => submitStatus(status)}
                                className={cn(
                                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition',
                                  isCurrent
                                    ? 'bg-stone-950 text-white'
                                    : 'border border-stone-200 bg-white text-stone-700 hover:border-stone-400',
                                  isPending && 'cursor-not-allowed opacity-70',
                                )}
                              >
                                {leadStatusLabelMap[status]}
                              </button>
                            );
                          })}
                        </div>
                        {statusMessage && (
                          <p className="text-xs text-stone-500">{statusMessage}</p>
                        )}
                      </div>
                    </TabsContent>

                    {/* ── Proposal ── */}
                    <TabsContent value="proposal" className="space-y-4 mt-0">
                      <Textarea
                        className="min-h-52 w-full rounded-xl border border-stone-300 bg-stone-950 p-4 text-sm leading-6 text-stone-100 outline-none transition focus:border-stone-500 focus-visible:ring-0"
                        value={proposalDraft}
                        onChange={(e) => setProposalDraft(e.target.value)}
                        placeholder="Write your proposal here..."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveProposal('regenerate')}
                        >
                          Regenerate draft
                        </Button>
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveProposal('edit')}
                        >
                          Save as new version
                        </Button>
                      </div>
                      {statusMessage && (
                        <p className="text-xs text-stone-500">{statusMessage}</p>
                      )}
                      {selectedLead.proposals.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Version history
                          </p>
                          {selectedLead.proposals.map((proposal, index) => (
                            <div
                              key={proposal.id}
                              className="rounded-xl border border-stone-200 bg-white p-4 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-stone-900">
                                  V{selectedLead.proposals.length - index}
                                  {proposal.isPrimary ? ' · Primary' : ''}
                                </p>
                                <span className="text-xs text-stone-500">
                                  {proposal.isAiGenerated ? 'AI draft' : 'Manual edit'} · {proposal.createdAt}
                                </span>
                              </div>
                              <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-stone-600">
                                {proposal.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* ── Application ── */}
                    <TabsContent value="application" className="space-y-4 mt-0">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="app-connects">Connects spent</Label>
                          <Input
                            id="app-connects"
                            inputMode="numeric"
                            value={connectsSpent}
                            onChange={(e) => setConnectsSpent(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="app-applied-at">Applied at</Label>
                          <Input
                            id="app-applied-at"
                            type="datetime-local"
                            value={appliedAt}
                            onChange={(e) => setAppliedAt(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="app-followup-at">Last follow-up</Label>
                          <Input
                            id="app-followup-at"
                            type="datetime-local"
                            value={lastFollowUpAt}
                            onChange={(e) => setLastFollowUpAt(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="app-notes">Notes</Label>
                        <Textarea
                          id="app-notes"
                          rows={5}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Operational notes about this application..."
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <Button size="sm" disabled={isPending} onClick={submitApplication}>
                          {isPending ? 'Saving...' : 'Save application'}
                        </Button>
                        {selectedLead.application && (
                          <p className="text-xs text-stone-500">
                            Last saved {selectedLead.application.updatedAt}
                          </p>
                        )}
                      </div>
                      {statusMessage && (
                        <p className="text-xs text-stone-500">{statusMessage}</p>
                      )}
                    </TabsContent>

                    {/* ── Activity ── */}
                    <TabsContent value="activity" className="space-y-3 mt-0">
                      {selectedLead.events.length > 0 ? (
                        selectedLead.events.map((event) => (
                          <div
                            key={event.id}
                            className="rounded-xl border border-stone-200 bg-white p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-stone-900">{event.type}</p>
                              <p className="text-xs text-stone-500">{event.createdAt}</p>
                            </div>
                            {event.payload && (
                              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500">
                          No lead events have been recorded yet.
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
