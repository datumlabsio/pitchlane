'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileEdit,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  StickyNote,
  X,
} from 'lucide-react';

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
  type LeadEnrichment,
  type LeadSummary,
} from '@/domain/leads/types';
import { cn } from '@/lib/utils';

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

// Render text with any URLs turned into clickable links.
function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
          >
            {part.length > 48 ? `${part.slice(0, 48)}…` : part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Upwork enrichment panel
// ---------------------------------------------------------------------------

function EnrichmentBadge({ status }: { status: LeadEnrichment['status'] }) {
  if (!status) return null;
  const map = {
    enriched: { dot: 'bg-emerald-500', cls: 'bg-emerald-100 text-emerald-700', label: 'Full description' },
    private: { dot: 'bg-amber-500', cls: 'bg-amber-100 text-amber-700', label: 'Private / invite-only' },
    failed: { dot: 'bg-stone-400', cls: 'bg-stone-100 text-stone-600', label: "Couldn't fetch" },
  } as const;
  const m = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', m.cls)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

function EnrichmentPanel({ enrichment }: { enrichment: LeadEnrichment }) {
  const c = enrichment.client;
  const location = [c.location, c.country].filter(Boolean).join(', ');
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [];
  if (c.paymentVerified !== null)
    rows.push({ label: 'Payment', value: c.paymentVerified ? 'Verified ✓' : 'Unverified', strong: c.paymentVerified });
  if (c.totalSpent) rows.push({ label: 'Client spent', value: c.totalSpent });
  if (c.totalHires !== null)
    rows.push({ label: 'Total hires', value: c.activeHires !== null ? `${c.totalHires} (${c.activeHires} active)` : String(c.totalHires) });
  if (c.hours !== null) rows.push({ label: 'Hours billed', value: `${c.hours} hrs` });
  if (c.rating !== null) rows.push({ label: 'Client rating', value: `${c.rating.toFixed(2)} / 5` });
  if (location) rows.push({ label: 'Location', value: location });
  if (enrichment.proposalsCount !== null) rows.push({ label: 'Proposals', value: String(enrichment.proposalsCount) });
  if (enrichment.paymentType) rows.push({ label: 'Job type', value: enrichment.paymentType });
  if (c.industry) rows.push({ label: 'Industry', value: c.industry });
  if (c.companySize) rows.push({ label: 'Company', value: c.companySize });
  if (c.memberSince) rows.push({ label: 'Member since', value: c.memberSince });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-emerald-500" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Upwork client &amp; job</p>
      </div>
      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {rows.map((r) => (
            <div key={r.label} className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-stone-400">{r.label}</p>
              <p className={cn('mt-0.5 text-sm font-medium', r.strong ? 'text-emerald-700' : 'text-stone-800')}>
                {r.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-400">Enriched, but the actor returned no client details.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------

type LeadEvent = LeadDetail['events'][number];

function StatusChip({ code }: { code: string }) {
  const label = leadStatusLabelMap[code as LeadSummary['statusCode']] ?? code;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        statusBadgeVariant(code as LeadSummary['statusCode']),
      )}
    >
      {label}
    </span>
  );
}

function ActivityItem({ event, isLast }: { event: LeadEvent; isLast: boolean }) {
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  const meta: { icon: typeof Mail; title: string; tint: string } = (() => {
    switch (event.type) {
      case 'lead.ingested_from_email':
        return { icon: Mail, title: 'Captured from email', tint: 'bg-sky-100 text-sky-700' };
      case 'lead.status_updated':
        return { icon: ArrowRight, title: 'Status changed', tint: 'bg-amber-100 text-amber-700' };
      case 'lead.enriched':
        return { icon: Sparkles, title: 'Enriched from Upwork', tint: 'bg-emerald-100 text-emerald-700' };
      case 'proposal.regenerated':
        return { icon: RefreshCw, title: 'Proposal regenerated', tint: 'bg-violet-100 text-violet-700' };
      case 'proposal.edited':
        return { icon: FileEdit, title: 'Proposal edited', tint: 'bg-stone-100 text-stone-700' };
      default:
        return { icon: Sparkles, title: event.type.replace(/[._]/g, ' '), tint: 'bg-stone-100 text-stone-700' };
    }
  })();

  const Icon = meta.icon;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', meta.tint)}>
          <Icon className="size-3.5" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-stone-200" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-stone-900">{meta.title}</p>
          <p className="shrink-0 text-xs text-stone-400">{event.createdAt}</p>
        </div>
        <div className="mt-1.5 text-sm text-stone-600">
          {event.type === 'lead.status_updated' && payload.to ? (
            <div className="flex items-center gap-2">
              {payload.from ? <StatusChip code={String(payload.from)} /> : <span className="text-xs text-stone-400">New lead</span>}
              <ArrowRight className="size-3.5 text-stone-400" />
              <StatusChip code={String(payload.to)} />
            </div>
          ) : event.type === 'lead.ingested_from_email' ? (
            <p className="text-xs text-stone-500">
              {payload.from ? <>From <span className="text-stone-700">{String(payload.from)}</span></> : 'Forwarded email'}
              {payload.gmailLabel ? <> · routed via <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px]">{String(payload.gmailLabel)}</code></> : null}
            </p>
          ) : (event.type === 'proposal.regenerated' || event.type === 'proposal.edited') && payload.versionCount ? (
            <p className="text-xs text-stone-500">Now on version {String(payload.versionCount)}</p>
          ) : event.type === 'lead.enriched' ? (
            <p className="text-xs text-stone-500">
              {payload.score != null ? <>Re-scored to <span className="text-stone-700">{String(payload.score)}%</span></> : 'Full job + client details fetched'}
              {payload.proposalsCount != null ? <> · {String(payload.proposalsCount)} proposals on the job</> : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
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
        items={{ all: 'All profiles', ...Object.fromEntries(accounts.map((a) => [a.id, a.personName])) }}
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
        items={{ all: 'All statuses', ...leadStatusLabelMap }}
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

    if (source === 'INVITE' && !sourceUrl.trim()) {
      setIngestStatus('Upwork job URL is required for invites.');
      return;
    }

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
          <Select
            value={source}
            onValueChange={(v: string | null) => setSource(v ?? 'EMAIL_FORWARD')}
            items={Object.fromEntries(LEAD_SOURCES.map((s) => [s.value, s.label]))}
          >
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
          <Label htmlFor="ingest-source-url">
            Upwork job URL{source === 'INVITE' ? ' *' : ''}
          </Label>
          <Input
            id="ingest-source-url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.upwork.com/jobs/~..."
            required={source === 'INVITE'}
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
  enrichmentEnabled = false,
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
  enrichmentEnabled?: boolean;
}) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [proposalDraft, setProposalDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [proposalFeedback, setProposalFeedback] = useState('');
  const [connectsSpent, setConnectsSpent] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [lastFollowUpAt, setLastFollowUpAt] = useState('');
  const [notes, setNotes] = useState('');
  const [ingestOpen, setIngestOpen] = useState(false);

  useEffect(() => {
    setProposalDraft(selectedLead?.proposals[0]?.content ?? '');
    setProposalFeedback('');
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

  function enrichLead() {
    if (!selectedLead) return;
    void runRequest(
      `/api/leads/${selectedLead.id}/enrich`,
      { method: 'POST' },
      'Enriched from Upwork — score updated.',
    );
  }

  function copyProposal() {
    navigator.clipboard
      .writeText(proposalDraft)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setStatusMessage('Could not copy to clipboard.'));
  }

  function saveProposal(mode: 'edit' | 'regenerate') {
    if (!selectedLead) return;
    if (mode === 'edit' && proposalDraft.trim().length === 0) {
      setStatusMessage('Proposal content is required.');
      return;
    }
    const feedback = proposalFeedback.trim();
    void runRequest(
      `/api/leads/${selectedLead.id}/proposals`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'edit'
            ? { mode, content: proposalDraft }
            : { mode, ...(feedback ? { feedback } : {}) },
        ),
      },
      mode === 'edit'
        ? 'Proposal version saved.'
        : feedback
          ? 'Proposal regenerated with your feedback.'
          : 'Proposal regenerated.',
    );
    if (mode === 'regenerate') setProposalFeedback('');
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
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate">{lead.title}</span>
                        {lead.sourceUrl && (
                          <a
                            href={lead.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open job on Upwork"
                            className="mt-0.5 shrink-0 text-stone-400 transition hover:text-emerald-600"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
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
                      {lead.matchScore}%
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
        <SheetContent side="right" className="data-[side=right]:w-[70vw] data-[side=right]:max-w-[70vw] data-[side=right]:sm:max-w-[70vw] p-0 flex flex-col">
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
                  <EnrichmentBadge status={selectedLead.enrichment?.status ?? null} />
                  <div className="ml-auto flex items-center gap-2">
                    {enrichmentEnabled && selectedLead.sourceUrl && (
                      <button
                        type="button"
                        onClick={enrichLead}
                        disabled={isPending}
                        title="Fetch full job + client details from Upwork"
                        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 disabled:opacity-60"
                      >
                        <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
                        {selectedLead.enrichment?.status === 'failed'
                          ? 'Retry fetch'
                          : selectedLead.enrichment?.status
                            ? 'Re-enrich'
                            : 'Enrich'}
                      </button>
                    )}
                    {selectedLead.sourceUrl ? (
                      <a
                        href={selectedLead.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        View job on Upwork
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs font-medium text-stone-400">
                        No job link captured
                      </span>
                    )}
                  </div>
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
                            {selectedLead.matchScore}%
                          </p>
                        </div>
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">Proposals</p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {selectedLead.enrichment?.proposalsCount != null
                              ? selectedLead.enrichment.proposalsCount
                              : '—'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">Client spent</p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {selectedLead.enrichment?.client.totalSpent ?? '—'}
                          </p>
                        </div>
                      </div>

                      {/* Upwork enrichment */}
                      {selectedLead.enrichment?.status === 'enriched' && (
                        <EnrichmentPanel enrichment={selectedLead.enrichment} />
                      )}
                      {selectedLead.enrichment?.status === 'private' && (
                        <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm leading-6 text-amber-800">
                          This is a private / invite-only job — only the invited profile can open it, so we&apos;re working from the email content below.
                        </p>
                      )}
                      {selectedLead.enrichment?.status === 'failed' && (
                        <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm leading-6 text-stone-600">
                          Couldn&apos;t fetch the full job page (Upwork blocked the request). Using the email content below — hit <span className="font-medium">Retry fetch</span> above to try again.
                        </p>
                      )}

                      {/* Notes */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <StickyNote className="size-3.5 text-amber-500" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Notes</p>
                        </div>
                        {selectedLead.application?.notes ? (
                          <p className="whitespace-pre-wrap rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm leading-6 text-stone-700">
                            {selectedLead.application.notes}
                          </p>
                        ) : (
                          <p className="text-sm text-stone-400">
                            No notes yet — add them in the Application tab.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                          {selectedLead.enrichment?.description ? 'Job description' : 'Lead brief'}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">
                          <LinkifiedText
                            text={
                              (
                                selectedLead.enrichment?.description ||
                                selectedLead.brief ||
                                ''
                              ).slice(0, selectedLead.enrichment?.description ? 4000 : 1500) ||
                              'No lead copy captured.'
                            }
                          />
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
                          disabled={!proposalDraft.trim()}
                          onClick={copyProposal}
                        >
                          {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
                          {copied ? 'Copied' : 'Copy'}
                        </Button>
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveProposal('edit')}
                        >
                          Save as new version
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveProposal('regenerate')}
                        >
                          <RefreshCw className="mr-1.5 size-3.5" />
                          Regenerate from scratch
                        </Button>
                      </div>

                      {/* Feedback-driven regeneration */}
                      <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-2.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-amber-500" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Improve with feedback
                          </p>
                        </div>
                        <Textarea
                          rows={3}
                          value={proposalFeedback}
                          onChange={(e) => setProposalFeedback(e.target.value)}
                          placeholder="e.g. Make it shorter, lead with the dbt + Snowflake experience, drop the generic intro, add a question about their current warehouse."
                          className="resize-none text-sm"
                        />
                        <Button
                          size="sm"
                          disabled={isPending || proposalFeedback.trim().length === 0}
                          onClick={() => saveProposal('regenerate')}
                        >
                          {isPending ? 'Rewriting…' : 'Rewrite with this feedback'}
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
                    <TabsContent value="activity" className="mt-0">
                      {selectedLead.events.length > 0 ? (
                        <div className="pl-0.5">
                          {selectedLead.events.map((event, i) => (
                            <ActivityItem
                              key={event.id}
                              event={event}
                              isLast={i === selectedLead.events.length - 1}
                            />
                          ))}
                        </div>
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
