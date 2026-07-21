"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  Columns3,
  Copy,
  ExternalLink,
  FileEdit,
  Mail,
  Plus,
  RefreshCw,
  Rows3,
  Search,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/filters/date-range-filter";
import { MultiSelectFilter } from "@/components/filters/multi-select";
import { Topbar } from "@/components/layout/topbar";
import {
  leadFilterStatuses,
  leadLifecycleStatuses,
  leadStatusLabelMap,
  type LeadDetail,
  type LeadEnrichment,
  type LeadStatusCode,
  type LeadSummary,
} from "@/domain/leads/types";
import { stageGuide } from "@/domain/leads/stage-guide";
import { LeadKanban } from "./lead-kanban";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAppliedLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// A day picked from the calendar arrives at local midnight; anchor it to noon so
// it reads as a clean date (not "12:00 AM") and dodges timezone-boundary drift.
function dayAtNoon(day: Date) {
  const d = new Date(day);
  d.setHours(12, 0, 0, 0);
  return d;
}

function statusBadgeVariant(statusCode: LeadSummary["statusCode"]) {
  switch (statusCode) {
    case "QUALIFIED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "REJECTED":
    case "LOST":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "APPLIED":
    case "CLIENT_REPLIED":
    case "INTRO_CALL":
    case "ONGOING_DISCUSSION":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "WON":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "HIRES_OTHER":
    case "JOB_CLOSED":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-stone-100 text-stone-600 border-stone-200";
  }
}

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
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

function EnrichmentBadge({ status }: { status: LeadEnrichment["status"] }) {
  if (!status) return null;
  const map = {
    enriched: {
      dot: "bg-emerald-500",
      cls: "bg-emerald-100 text-emerald-700",
      label: "Full description",
    },
    private: {
      dot: "bg-amber-500",
      cls: "bg-amber-100 text-amber-700",
      label: "Private / invite-only",
    },
    failed: {
      dot: "bg-amber-500",
      cls: "bg-amber-100 text-amber-700",
      label: "Private / closed",
    },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        m.cls,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

// How the description was fetched — official Upwork API vs. web scrape.
function SourceBadge({ source }: { source: LeadEnrichment["source"] }) {
  if (!source) return null;
  const m =
    source === "upwork_api"
      ? { cls: "bg-sky-100 text-sky-700", label: "via Upwork API" }
      : { cls: "bg-violet-100 text-violet-700", label: "via web scrape" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

// Shown in the proposal tab when a lead has no proposal yet, explaining why and
// what to do. A proposal is auto-written only for enriched leads above the qualify
// score; everything else lands here (fetched-but-not-drafted, pending, or unfetchable).
function ProposalEmptyState({
  status,
  hasUrl,
  onGenerate,
  generating,
}: {
  status: LeadEnrichment["status"];
  hasUrl: boolean;
  onGenerate: () => void;
  generating: boolean;
}) {
  // status null + a job URL => enrichment simply hasn't run yet (pending).
  const pending = status === null && hasUrl;

  let tone: "pending" | "info" | "warn" = "warn";
  let title: string;
  let reason: string;
  if (pending) {
    tone = "pending";
    title = "Fetching the job description…";
    reason =
      "The proposal is written automatically once enrichment pulls the full Upwork job — usually within seconds of the lead arriving.";
  } else if (status === "enriched") {
    // Description fetched, but no proposal: it scored below the auto-draft bar.
    tone = "info";
    title = "Description fetched — no proposal yet";
    reason =
      "We only auto-draft proposals for leads above your qualify score, to save on AI cost. The full job description is below — generate a proposal whenever you want one.";
  } else if (status === "private") {
    title = "Description not fetched — private / invite-only job";
    reason =
      "Upwork only shows invite-only jobs to the invited account, so the description can't be fetched automatically. Generate from the email below if it contains the brief.";
  } else if (status === "failed") {
    title = "Job is private or no longer available";
    reason =
      "Upwork isn't showing this job publicly — it's invite-only or has been closed — so the full description can't be fetched. Generate from the email below if it has the brief.";
  } else {
    title = "Description not fetched — no job link";
    reason =
      "There's no Upwork job link on this lead, so there's nothing to fetch automatically. Generate from the email below if you want a draft.";
  }

  const styles = {
    pending: { box: "border-sky-200 bg-sky-50/70", dot: "bg-sky-500" },
    info: { box: "border-emerald-200 bg-emerald-50/70", dot: "bg-emerald-500" },
    warn: { box: "border-amber-200 bg-amber-50/70", dot: "bg-amber-500" },
  }[tone];

  return (
    <div className={cn("rounded-xl border p-4", styles.box)}>
      <div className="flex items-center gap-2">
        {pending ? (
          <RefreshCw className="size-4 animate-spin text-sky-600" />
        ) : (
          <span className={cn("size-2 rounded-full", styles.dot)} />
        )}
        <p className="text-sm font-semibold text-stone-800">{title}</p>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-stone-600">{reason}</p>
      {/* No point offering "generate" while enrichment is still in flight. */}
      {!pending && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="size-3.5" />
          {generating ? "Generating…" : "Generate a proposal"}
        </button>
      )}
    </div>
  );
}

function EnrichmentPanel({ enrichment }: { enrichment: LeadEnrichment }) {
  const c = enrichment.client;
  const location = [c.location, c.country].filter(Boolean).join(", ");
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [];
  if (c.paymentVerified !== null)
    rows.push({
      label: "Payment",
      value: c.paymentVerified ? "Verified ✓" : "Unverified",
      strong: c.paymentVerified,
    });
  if (c.totalSpent) rows.push({ label: "Client spent", value: c.totalSpent });
  if (c.totalHires !== null)
    rows.push({
      label: "Total hires",
      value:
        c.activeHires !== null
          ? `${c.totalHires} (${c.activeHires} active)`
          : String(c.totalHires),
    });
  if (c.hours !== null)
    rows.push({ label: "Hours billed", value: `${c.hours} hrs` });
  if (c.rating !== null)
    rows.push({ label: "Client rating", value: `${c.rating.toFixed(2)} / 5` });
  if (location) rows.push({ label: "Location", value: location });
  if (enrichment.proposalsCount !== null)
    rows.push({ label: "Proposals", value: String(enrichment.proposalsCount) });
  if (enrichment.paymentType)
    rows.push({ label: "Job type", value: enrichment.paymentType });
  if (c.industry) rows.push({ label: "Industry", value: c.industry });
  if (c.companySize) rows.push({ label: "Company", value: c.companySize });
  if (c.memberSince) rows.push({ label: "Member since", value: c.memberSince });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-emerald-500" />
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Upwork client &amp; job
        </p>
      </div>
      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-widest text-stone-400">
                {r.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-medium",
                  r.strong ? "text-emerald-700" : "text-stone-800",
                )}
              >
                {r.value}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-400">
          Enriched, but no public client details were available for this job.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------

type LeadEvent = LeadDetail["events"][number];

function StatusChip({ code }: { code: string }) {
  const label = leadStatusLabelMap[code as LeadSummary["statusCode"]] ?? code;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        statusBadgeVariant(code as LeadSummary["statusCode"]),
      )}
    >
      {label}
    </span>
  );
}

function ActivityItem({
  event,
  isLast,
}: {
  event: LeadEvent;
  isLast: boolean;
}) {
  const payload = (event.payload ?? {}) as Record<string, unknown>;

  const meta: { icon: typeof Mail; title: string; tint: string } = (() => {
    switch (event.type) {
      case "lead.ingested_from_email":
        return {
          icon: Mail,
          title: "Captured from email",
          tint: "bg-sky-100 text-sky-700",
        };
      case "lead.status_updated":
        return {
          icon: ArrowRight,
          title: "Status changed",
          tint: "bg-amber-100 text-amber-700",
        };
      case "lead.enriched":
        return {
          icon: Sparkles,
          title: "Enriched from Upwork",
          tint: "bg-emerald-100 text-emerald-700",
        };
      case "proposal.regenerated":
        return {
          icon: RefreshCw,
          title: "Proposal regenerated",
          tint: "bg-violet-100 text-violet-700",
        };
      case "proposal.edited":
        return {
          icon: FileEdit,
          title: "Proposal edited",
          tint: "bg-stone-100 text-stone-700",
        };
      case "proposal.sent_recorded":
        return {
          icon: FileEdit,
          title: "Sent proposal recorded",
          tint: "bg-emerald-100 text-emerald-700",
        };
      case "lead.profiles_suggested":
        return {
          icon: Sparkles,
          title: "Also fits other profiles",
          tint: "bg-amber-100 text-amber-700",
        };
      case "proposal.feedback_updated":
        return {
          icon: FileEdit,
          title: "Manager feedback on proposal",
          tint: "bg-violet-100 text-violet-700",
        };
      case "application.bu_review_updated":
        return {
          icon: Check,
          title:
            payload.buReviewed === false ? "BU review unmarked" : "BU reviewed",
          tint: "bg-amber-100 text-amber-700",
        };
      case "application.proposal_viewed_updated":
        return {
          icon: Check,
          title:
            payload.proposalViewed === false
              ? "Proposal viewed unmarked"
              : "Proposal viewed",
          tint: "bg-sky-100 text-sky-700",
        };
      default:
        return {
          icon: Sparkles,
          title: event.type.replace(/[._]/g, " "),
          tint: "bg-stone-100 text-stone-700",
        };
    }
  })();

  const Icon = meta.icon;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            meta.tint,
          )}
        >
          <Icon className="size-3.5" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-stone-200" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-stone-900">
            {meta.title}
            {typeof payload.actor === "string" && payload.actor && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  payload.actor === "system"
                    ? "bg-stone-100 text-stone-500"
                    : "bg-amber-50 text-amber-800",
                )}
              >
                {payload.actor === "system" ? "system" : `by ${payload.actor}`}
              </span>
            )}
          </p>
          <p className="shrink-0 text-xs text-stone-400">{event.createdAt}</p>
        </div>
        <div className="mt-1.5 text-sm text-stone-600">
          {event.type === "lead.status_updated" && payload.to ? (
            <div className="flex items-center gap-2">
              {payload.from ? (
                <StatusChip code={String(payload.from)} />
              ) : (
                <span className="text-xs text-stone-400">New lead</span>
              )}
              <ArrowRight className="size-3.5 text-stone-400" />
              <StatusChip code={String(payload.to)} />
            </div>
          ) : event.type === "lead.ingested_from_email" ? (
            <p className="text-xs text-stone-500">
              {payload.from ? (
                <>
                  From{" "}
                  <span className="text-stone-700">{String(payload.from)}</span>
                </>
              ) : (
                "Forwarded email"
              )}
              {payload.gmailLabel ? (
                <>
                  {" "}
                  · routed via{" "}
                  <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px]">
                    {String(payload.gmailLabel)}
                  </code>
                </>
              ) : null}
            </p>
          ) : (event.type === "proposal.regenerated" ||
              event.type === "proposal.edited") &&
            payload.versionCount ? (
            <p className="text-xs text-stone-500">
              Now on version {String(payload.versionCount)}
            </p>
          ) : event.type === "lead.profiles_suggested" &&
            Array.isArray(payload.profiles) ? (
            <p className="text-xs text-stone-500">
              {payload.profiles.map(String).join(" · ")}
            </p>
          ) : event.type === "proposal.feedback_updated" &&
            typeof payload.excerpt === "string" &&
            payload.excerpt ? (
            <p className="rounded-md border border-violet-100 bg-violet-50/60 px-2.5 py-1.5 text-xs text-stone-600">
              “{payload.excerpt}”
            </p>
          ) : event.type === "lead.enriched" ? (
            <p className="text-xs text-stone-500">
              {payload.score != null ? (
                <>
                  Re-scored to{" "}
                  <span className="text-stone-700">
                    {String(payload.score)}%
                  </span>
                </>
              ) : (
                "Full job + client details fetched"
              )}
              {payload.proposalsCount != null ? (
                <> · {String(payload.proposalsCount)} proposals on the job</>
              ) : null}
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
type CurrentFilters = {
  accountId?: string;
  status?: string;
  search?: string;
  since?: string;
  from?: string;
  to?: string;
};

function FilterBar({
  accounts,
  currentFilters,
}: {
  accounts: FilterAccount[];
  currentFilters: CurrentFilters;
}) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState<string>(
    currentFilters.search ?? "",
  );
  const hasFilters = !!(
    currentFilters.accountId ||
    currentFilters.status ||
    currentFilters.search ||
    currentFilters.since ||
    currentFilters.from ||
    currentFilters.to
  );

  function buildUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams();
    if (currentFilters.accountId)
      params.set("accountId", currentFilters.accountId);
    if (currentFilters.status) params.set("status", currentFilters.status);
    if (currentFilters.search) params.set("search", currentFilters.search);
    if (currentFilters.since) params.set("since", currentFilters.since);
    if (currentFilters.from) params.set("from", currentFilters.from);
    if (currentFilters.to) params.set("to", currentFilters.to);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    params.delete("leadId");
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput || null }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectFilter
        param="accountId"
        label="Profiles"
        options={accounts.map((a) => ({ value: a.id, label: a.personName }))}
      />

      <MultiSelectFilter
        param="status"
        label="Status"
        options={leadFilterStatuses.map((value) => ({
          value,
          label: leadStatusLabelMap[value],
        }))}
      />

      <DateRangeFilter />

      <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, text, job URL"
            className="h-8 w-52 rounded-md border border-stone-200 bg-white pl-8 pr-3 text-xs outline-none transition focus:border-stone-400 focus:ring-1 focus:ring-stone-300"
          />
        </div>
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
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
    if (currentFilters.accountId)
      params.set("accountId", currentFilters.accountId);
    if (currentFilters.status) params.set("status", currentFilters.status);
    if (currentFilters.search) params.set("search", currentFilters.search);
    if (currentFilters.since) params.set("since", currentFilters.since);
    if (currentFilters.from) params.set("from", currentFilters.from);
    if (currentFilters.to) params.set("to", currentFilters.to);
    params.set("page", String(targetPage));
    return `/leads?${params.toString()}`;
  }

  if (totalPages <= 1 && total <= 20) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-1">
      <p className="text-xs text-stone-500">
        {total} lead{total !== 1 ? "s" : ""}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </p>
      {totalPages > 1 && (
        <div className="flex gap-1.5">
          <Link
            href={buildPageUrl(page - 1)}
            aria-disabled={page <= 1}
            className={cn(
              "rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400",
              page <= 1 && "pointer-events-none opacity-40",
            )}
          >
            Previous
          </Link>
          <Link
            href={buildPageUrl(page + 1)}
            aria-disabled={page >= totalPages}
            className={cn(
              "rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 transition hover:border-stone-400",
              page >= totalPages && "pointer-events-none opacity-40",
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
  "We need a Power BI specialist with SQL and dashboard design experience to improve weekly executive reporting. Budget is $1,500 fixed.";

const LEAD_SOURCES = [
  { value: "EMAIL_FORWARD", label: "Email forward" },
  { value: "INVITE", label: "Invite (client-initiated)" },
  { value: "MANUAL", label: "Manual entry" },
] as const;

function ManualIngestDialogContent({
  labels,
  onSuccess,
}: {
  labels: string[];
  onSuccess: () => void;
}) {
  const [ingestStatus, setIngestStatus] = useState("");
  const [ingestPending, setIngestPending] = useState(false);
  const [gmailLabel, setGmailLabel] = useState(labels[0] ?? "");
  const [source, setSource] = useState<string>("EMAIL_FORWARD");
  const [sender, setSender] = useState("alerts@upwork.com");
  const [subject, setSubject] = useState(
    "Power BI Dashboard Optimization for Executive Team",
  );
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sourceUrl, setSourceUrl] = useState(
    "https://www.upwork.com/jobs/~manual-test-lead",
  );
  const [budget, setBudget] = useState("$1,500 fixed");
  const [skills, setSkills] = useState("power bi, sql, dashboard");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (source === "INVITE" && !sourceUrl.trim()) {
      setIngestStatus("Upwork job URL is required for invites.");
      return;
    }

    setIngestPending(true);
    setIngestStatus("");

    const payload = {
      gmailLabel,
      source,
      from: sender,
      subject,
      body,
      sourceUrl,
      extractedBudget: budget,
      extractedSkills: skills
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch("/api/ingest/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setIngestStatus(result.error ?? "Ingestion failed.");
      } else {
        setIngestStatus(
          result.duplicate
            ? `Duplicate ignored for "${subject}".`
            : `Lead created with status ${result.status}.`,
        );
        onSuccess();
      }
    } catch (error) {
      setIngestStatus(
        error instanceof Error ? error.message : "Unknown error.",
      );
    } finally {
      setIngestPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ingest-label">Profile label</Label>
          <Select
            value={gmailLabel}
            onValueChange={(value: string | null) => setGmailLabel(value ?? "")}
          >
            <SelectTrigger id="ingest-label" className="w-full">
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
            onValueChange={(v: string | null) =>
              setSource(v ?? "EMAIL_FORWARD")
            }
            items={Object.fromEntries(
              LEAD_SOURCES.map((s) => [s.value, s.label]),
            )}
          >
            <SelectTrigger id="ingest-source" className="w-full">
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
            Upwork job URL{source === "INVITE" ? " *" : ""}
          </Label>
          <Input
            id="ingest-source-url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://www.upwork.com/jobs/~..."
            required={source === "INVITE"}
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
          {ingestPending ? "Submitting..." : "Create lead"}
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

// Small "auto-updating" indicator for the leads header.
function LiveIndicator({ paused }: { paused: boolean }) {
  return (
    <span
      className="!hidden inline-flex items-center gap-1.5 text-xs text-stone-500"
      title={
        paused
          ? "Auto-refresh paused while a lead is open"
          : "Auto-updating every 60s"
      }
    >
      <span className="relative flex size-2">
        {!paused && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            paused ? "bg-stone-300" : "bg-emerald-500",
          )}
        />
      </span>
      {paused ? "Paused" : "Live"}
    </span>
  );
}

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
  view = "list",
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
  view?: "list" | "kanban";
  enrichmentEnabled?: boolean;
}) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [proposalDraft, setProposalDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [proposalFeedback, setProposalFeedback] = useState("");
  const [citedProjectIds, setCitedProjectIds] = useState<string[]>([]);
  // Lifecycle pills select a pending status; Apply commits it. A single stray
  // click must never change the status.
  const [pendingStatus, setPendingStatus] = useState<
    (typeof leadLifecycleStatuses)[number] | null
  >(null);
  // Multi-profile apply: pick target profiles → a linked copy is created on each.
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [connectsSpent, setConnectsSpent] = useState("");
  const [connectsRefunded, setConnectsRefunded] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [appliedPickerOpen, setAppliedPickerOpen] = useState(false);
  const [lastFollowUpAt, setLastFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  // Review trail: the proposal actually sent on Upwork, the manager's feedback on
  // it, and the two review toggles. Distinct from `proposalFeedback` above, which
  // steers AI regeneration and is never persisted.
  const [sentProposal, setSentProposal] = useState("");
  const [sentFeedback, setSentFeedback] = useState("");
  const [buReviewed, setBuReviewed] = useState(false);
  const [proposalViewed, setProposalViewed] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);

  useEffect(() => {
    setProposalDraft(selectedLead?.proposals[0]?.content ?? "");
    setProposalFeedback("");
    setCitedProjectIds(selectedLead?.relevantProjects.map((p) => p.id) ?? []);
    setPendingStatus(null);
    setCopyOpen(false);
    setCopyTargets([]);
    setConnectsSpent(
      selectedLead?.application?.connectsSpent?.toString() ?? "",
    );
    setAppliedAt(
      formatDateTimeInput(selectedLead?.application?.appliedAt ?? null),
    );
    setLastFollowUpAt(
      formatDateTimeInput(selectedLead?.application?.lastFollowUpAt ?? null),
    );
    setNotes(selectedLead?.application?.notes ?? "");
    setConnectsRefunded(
      selectedLead?.application?.connectsRefunded?.toString() ?? "",
    );
    setSentProposal(selectedLead?.application?.sentProposal ?? "");
    setSentFeedback(selectedLead?.application?.proposalFeedback ?? "");
    setBuReviewed(selectedLead?.application?.buReviewed ?? false);
    setProposalViewed(selectedLead?.application?.proposalViewed ?? false);
    setStatusMessage("");
  }, [selectedLead]);

  // Auto-refresh the list so leads from the sync/enrich crons appear without a
  // manual reload. Soft refresh (re-runs the server query, keeps URL filters +
  // scroll, preserves list client state). Paused while a lead panel is open — a
  // refresh would reset the panel's inputs — and while the tab is backgrounded.
  useEffect(() => {
    if (selectedLeadId) return;
    const id = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        router.refresh();
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [selectedLeadId, router]);

  async function runRequest(
    url: string,
    init: RequestInit,
    successMessage:
      | string
      | ((result: {
          outcome?: string;
          leadsCreated?: number;
          profile?: string;
          score?: number;
          results?: Array<{ profile: string; outcome: string; score?: number }>;
        }) => string),
  ) {
    setStatusMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(url, init);
        const result = await response.json();
        if (!response.ok || !result.ok) {
          setStatusMessage(result.error ?? "Request failed.");
          return;
        }
        setStatusMessage(
          typeof successMessage === "function"
            ? successMessage(result)
            : successMessage,
        );
        router.refresh();
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Unknown request error.",
        );
      }
    });
  }

  function submitStatus(status: (typeof leadLifecycleStatuses)[number]) {
    if (!selectedLead) return;
    void runRequest(
      `/api/leads/${selectedLead.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
      `Lead moved to ${leadStatusLabelMap[status]}.`,
    );
  }

  // Persist the application. `appliedAtValue` is passed explicitly so the quick
  // "Mark applied" actions can set it without depending on the field's state
  // (the rest of the form — connects/follow-up/notes — is preserved as-is).
  function postApplication(
    appliedAtValue: string | null,
    message: string,
    // The review toggles save instantly on click; React state is async, so the
    // flipped value rides in as an override instead of being read back from state.
    overrides?: { buReviewed?: boolean; proposalViewed?: boolean },
  ) {
    if (!selectedLead) return;
    const parsedConnects =
      connectsSpent.trim().length > 0 ? Number(connectsSpent) : null;
    if (
      parsedConnects !== null &&
      (!Number.isInteger(parsedConnects) || parsedConnects < 0)
    ) {
      setStatusMessage("Connects spent must be a non-negative integer.");
      return;
    }
    const parsedRefunded =
      connectsRefunded.trim().length > 0 ? Number(connectsRefunded) : null;
    if (
      parsedRefunded !== null &&
      (!Number.isInteger(parsedRefunded) || parsedRefunded < 0)
    ) {
      setStatusMessage("Connects refunded must be a non-negative integer.");
      return;
    }
    void runRequest(
      "/api/applications",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          connectsSpent: parsedConnects,
          connectsRefunded: parsedRefunded,
          appliedAt: appliedAtValue,
          lastFollowUpAt: lastFollowUpAt || null,
          notes,
          sentProposal: sentProposal || null,
          proposalFeedback: sentFeedback || null,
          buReviewed,
          proposalViewed,
          ...overrides,
        }),
      },
      message,
    );
  }

  // Instant-save toggles — a manager ticking "viewed" shouldn't need to find Save.
  // These deliberately do NOT go through postApplication: that would persist the
  // whole half-edited form and refresh the panel (resetting every field mid-edit).
  // Instead: optimistic flip, a minimal partial POST of just this field, and a
  // revert if the save fails. No refresh — the rest of the form stays untouched.
  async function saveReviewToggle(
    field: "buReviewed" | "proposalViewed",
    next: boolean,
  ) {
    if (!selectedLead) return;
    const setter = field === "buReviewed" ? setBuReviewed : setProposalViewed;
    const label = field === "buReviewed" ? "BU reviewed" : "Proposal viewed";
    setter(next);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedLead.id, [field]: next }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error ?? "Request failed");
      }
      setStatusMessage(next ? `Marked “${label}”.` : `Unmarked “${label}”.`);
    } catch (error) {
      setter(!next); // roll back — the server never got it
      setStatusMessage(
        `Could not save “${label}” — ${error instanceof Error ? error.message : "unknown error"}.`,
      );
    }
  }

  function submitApplication() {
    postApplication(appliedAt || null, "Application details saved.");
  }

  // One-click apply (or a custom calendar date). Setting appliedAt also moves the
  // lead to APPLIED server-side (see upsertApplication).
  function markApplied(date: Date) {
    setAppliedAt(formatDateTimeInput(date.toISOString()));
    setAppliedPickerOpen(false);
    postApplication(
      date.toISOString(),
      `Marked applied — ${formatAppliedLabel(date)}.`,
    );
  }

  function clearApplied() {
    setAppliedAt("");
    setAppliedPickerOpen(false);
    postApplication(null, "Cleared the applied date.");
  }

  function enrichLead() {
    if (!selectedLead) return;
    void runRequest(
      `/api/leads/${selectedLead.id}/enrich`,
      { method: "POST" },
      (result) =>
        result.outcome === "enriched"
          ? "Refreshed from Upwork — job details and score updated."
          : "This job isn't publicly viewable (private or closed), so there's nothing to fetch.",
    );
  }

  // Move a lead to a different profile (apply from another account). Re-scores
  // against the new profile's config; the proposal is cleared so you regenerate it.
  function reassign(leadId: string, accountId: string) {
    void runRequest(
      `/api/leads/${leadId}/account`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) },
      (r) => (r.profile ? `Moved to ${r.profile} — re-scored to ${r.score}%.` : "Profile updated."),
    );
  }

  // Force-pull: run the Gmail sync now (creates + enriches + alerts new leads
  // immediately) instead of waiting for the ~1-min cron, then refresh the list.
  function syncNow() {
    void runRequest(
      "/api/integrations/gmail/sync",
      { method: "POST" },
      (result) =>
        result.leadsCreated
          ? `Pulled ${result.leadsCreated} new lead${result.leadsCreated > 1 ? "s" : ""} — enriching now.`
          : "Synced — no new leads right now.",
    );
  }

  function copyProposal() {
    navigator.clipboard
      .writeText(proposalDraft)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => setStatusMessage("Could not copy to clipboard."));
  }

  function saveProposal(mode: "edit" | "regenerate") {
    if (!selectedLead) return;
    if (mode === "edit" && proposalDraft.trim().length === 0) {
      setStatusMessage("Proposal content is required.");
      return;
    }
    const feedback = proposalFeedback.trim();
    void runRequest(
      `/api/leads/${selectedLead.id}/proposals`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "edit"
            ? { mode, content: proposalDraft }
            : {
                mode,
                ...(feedback ? { feedback } : {}),
                // What the chips show is exactly what gets cited.
                ...(selectedLead.relevantProjects.length ? { projectIds: citedProjectIds } : {}),
              },
        ),
      },
      mode === "edit"
        ? "Proposal version saved."
        : feedback
          ? "Proposal regenerated with your feedback."
          : "Proposal regenerated.",
    );
    if (mode === "regenerate") setProposalFeedback("");
  }

  // Active filters as URL params — opening and closing a lead must both carry
  // them, otherwise opening (which navigates) wipes the filtered view.
  function buildFilterParams() {
    const params = new URLSearchParams();
    if (currentFilters.accountId)
      params.set("accountId", currentFilters.accountId);
    if (currentFilters.status) params.set("status", currentFilters.status);
    if (currentFilters.search) params.set("search", currentFilters.search);
    if (currentFilters.since) params.set("since", currentFilters.since);
    if (currentFilters.from) params.set("from", currentFilters.from);
    if (currentFilters.to) params.set("to", currentFilters.to);
    if (view === "kanban") params.set("view", "kanban");
    if (view !== "kanban" && page > 1) params.set("page", String(page));
    return params;
  }

  function switchView(next: "list" | "kanban") {
    if (next === view) return;
    const params = buildFilterParams();
    params.delete("page");
    params.delete("view");
    if (next === "kanban") params.set("view", "kanban");
    const qs = params.toString();
    router.push(qs ? `/leads?${qs}` : "/leads");
  }

  // Board actions work on any card, not just the open lead. Same endpoints as the
  // panel flows, so events/actors/metrics behave identically.
  function moveLeadFromBoard(leadId: string, to: LeadStatusCode) {
    void runRequest(
      `/api/leads/${leadId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      },
      `Lead moved to ${leadStatusLabelMap[to]}.`,
    );
  }

  function applyLeadFromBoard(
    leadId: string,
    connects: number | null,
    fromStatus: LeadStatusCode,
  ) {
    setStatusMessage("");
    startTransition(async () => {
      try {
        // Log the application (appliedAt=now). From NEW/QUALIFIED the upsert
        // itself promotes to APPLIED; from a later stage, set the status back
        // explicitly (same as the panel's Apply flow).
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId,
            appliedAt: new Date().toISOString(),
            ...(connects != null ? { connectsSpent: connects } : {}),
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.ok) {
          setStatusMessage(result.error ?? "Request failed.");
          return;
        }
        if (fromStatus !== "NEW" && fromStatus !== "QUALIFIED") {
          await fetch(`/api/leads/${leadId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPLIED" }),
          });
        }
        setStatusMessage("Marked applied.");
        router.refresh();
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Unknown request error.",
        );
      }
    });
  }

  function buildLeadUrl(leadId: string) {
    const params = buildFilterParams();
    params.set("leadId", leadId);
    return `/leads?${params.toString()}`;
  }

  function buildCloseUrl() {
    const qs = buildFilterParams().toString();
    return qs ? `/leads?${qs}` : "/leads";
  }

  function copyToProfiles() {
    if (!selectedLead || copyTargets.length === 0) return;
    const targets = [...copyTargets];
    setCopyOpen(false);
    setCopyTargets([]);
    void runRequest(
      `/api/leads/${selectedLead.id}/copy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: targets }),
      },
      (r) => {
        const copied = (r.results ?? []).filter((x) => x.outcome === "copied");
        const existing = (r.results ?? []).filter((x) => x.outcome === "already_exists");
        const parts: string[] = [];
        if (copied.length)
          parts.push(
            `Now also applying from ${copied
              .map((x) => `${x.profile} (${x.score}%)`)
              .join(", ")}.`,
          );
        if (existing.length)
          parts.push(`${existing.map((x) => x.profile).join(", ")} already had this lead.`);
        return parts.join(" ") || "No copies created.";
      },
    );
  }

  return (
    <>
      <Topbar
        title="Lead inbox"
        subtitle="All leads from forwarded Upwork emails, scored and ranked by profile rules."
        actions={
          <>
            <LiveIndicator paused={Boolean(selectedLeadId)} />
            <button
              type="button"
              onClick={syncNow}
              disabled={isPending}
              title="Pull new leads from Gmail right now — don't wait for the cron"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:border-stone-400 disabled:opacity-60"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} />
              {isPending ? 'Syncing…' : 'Sync now'}
            </button>
            <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
              <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
                <Plus className="h-3.5 w-3.5" />
                Add lead
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
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
          </>
        }
      />

      {/* Toolbar row: filters live on their own line so the page header stays
          just title + primary actions — no more everything crammed into one row. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterBar accounts={accounts} currentFilters={currentFilters} />
        <div className="ml-auto flex shrink-0 overflow-hidden rounded-md border border-stone-200">
          <button
            type="button"
            onClick={() => switchView("list")}
            title="List view"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition",
              view === "list"
                ? "bg-stone-800 text-white"
                : "bg-white text-stone-500 hover:bg-stone-50",
            )}
          >
            <Rows3 className="size-3.5" />
            List
          </button>
          <button
            type="button"
            onClick={() => switchView("kanban")}
            title="Kanban board — drag cards between stages"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition",
              view === "kanban"
                ? "bg-stone-800 text-white"
                : "bg-white text-stone-500 hover:bg-stone-50",
            )}
          >
            <Columns3 className="size-3.5" />
            Board
          </button>
        </div>
      </div>

      {!selectedLeadId && statusMessage && (
        <p className="text-xs text-stone-500">{statusMessage}</p>
      )}

      {view === "kanban" ? (
        <>
          <LeadKanban
            leads={leads}
            busy={isPending}
            onOpenLead={(id) => router.push(buildLeadUrl(id))}
            onMoveLead={moveLeadFromBoard}
            onApplyLead={applyLeadFromBoard}
          />
          {total > leads.length && (
            <p className="text-xs text-stone-400">
              Showing the {leads.length} most recent of {total} matching leads —
              narrow the filters (profile, status, date) to see the rest.
            </p>
          )}
        </>
      ) : (
        <>
      {/* Table */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <Table className="min-w-[640px]">
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
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-stone-500"
                >
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
                      "cursor-pointer transition-colors hover:bg-amber-50/60",
                      isSelected && "bg-amber-50",
                    )}
                    onClick={() => router.push(buildLeadUrl(lead.id))}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate">
                          {lead.title}
                        </span>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.accountId}
                        onValueChange={(v: string | null) => {
                          if (v && v !== lead.accountId) reassign(lead.id, v);
                        }}
                      >
                        <SelectTrigger
                          size="sm"
                          disabled={isPending}
                          title="Apply from a different profile — re-scores against it"
                          className="h-5 gap-0.5 rounded border-stone-200 bg-stone-50 px-1 py-0 text-[11px] font-normal leading-none text-stone-700 hover:bg-stone-100 [&_svg]:size-2.5"
                        >
                          <SelectValue>
                            {(value: string | null) =>
                              accounts.find((a) => a.id === value)?.personName ?? lead.profileName
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.personName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            statusBadgeVariant(lead.statusCode),
                          )}
                        >
                          {lead.status}
                        </span>
                        {lead.proposalViewed !== null && (
                          // WhatsApp-style read receipt: double green tick = the BU
                          // manager viewed the sent proposal; grey = not yet.
                          <CheckCheck
                            strokeWidth={2.5}
                            className={cn(
                              "size-4.5 shrink-0",
                              lead.proposalViewed
                                ? "text-emerald-500"
                                : "text-stone-300",
                            )}
                            aria-label={
                              lead.proposalViewed
                                ? "Proposal viewed by BU"
                                : "Awaiting BU review"
                            }
                          >
                            <title>
                              {lead.proposalViewed
                                ? "Proposal viewed by BU"
                                : "Awaiting BU review"}
                            </title>
                          </CheckCheck>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-stone-600">
                      {lead.matchScore}%
                    </TableCell>
                    <TableCell className="text-stone-600">
                      {lead.budget}
                    </TableCell>
                    <TableCell className="text-stone-500 text-xs">
                      {relativeTime(lead.createdAt)}
                    </TableCell>
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
        </>
      )}

      {/* Slide-over panel */}
      <Sheet
        open={selectedLead !== null}
        onOpenChange={(open) => {
          if (!open) router.push(buildCloseUrl());
        }}
      >
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:max-w-full data-[side=right]:lg:w-[70vw] data-[side=right]:lg:max-w-[70vw] p-0 flex flex-col"
        >
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
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      statusBadgeVariant(selectedLead.statusCode),
                    )}
                  >
                    {selectedLead.status}
                  </span>
                  <Select
                    value={selectedLead.accountId}
                    onValueChange={(v: string | null) => {
                      if (v && v !== selectedLead.accountId) reassign(selectedLead.id, v);
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      disabled={isPending}
                      title="Apply from a different profile — re-scores against it"
                      className="h-6 gap-1 rounded-md border-stone-200 bg-stone-50 px-1.5 py-0 text-xs font-normal text-stone-700 hover:bg-stone-100 [&_svg]:size-3"
                    >
                      <SelectValue>
                        {(value: string | null) =>
                          accounts.find((a) => a.id === value)?.personName ?? selectedLead.profileName
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.personName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
                    <DialogTrigger
                      render={
                        <button
                          type="button"
                          disabled={isPending}
                          title="Apply to this job from more profiles — creates a linked copy per profile, each re-scored for that person"
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-1.5 text-[11px] font-normal text-stone-600 transition hover:bg-stone-100 disabled:opacity-50"
                        />
                      }
                    >
                      <Plus className="size-3" />
                      Also apply from…
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Apply from more profiles</DialogTitle>
                      </DialogHeader>
                      <p className="text-xs leading-5 text-stone-500">
                        Creates a copy of this lead on each selected profile — re-scored by the
                        judge for that person, with its own proposal and lifecycle. Copies are
                        linked under “Also matched on other profiles”. Each application costs that
                        profile&apos;s connects.
                      </p>
                      <div className="space-y-1.5">
                        {accounts
                          .filter((a) => a.id !== selectedLead.accountId)
                          .map((a) => {
                            const alreadyHeld = selectedLead.duplicates.some(
                              (d) => d.profile === a.personName,
                            );
                            return (
                              <label
                                key={a.id}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                                  alreadyHeld
                                    ? "border-stone-100 bg-stone-50 text-stone-400"
                                    : "cursor-pointer border-stone-200 bg-white text-stone-700 hover:border-stone-300",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="size-3.5 accent-amber-600"
                                  disabled={alreadyHeld}
                                  checked={alreadyHeld || copyTargets.includes(a.id)}
                                  onChange={() =>
                                    setCopyTargets((ids) =>
                                      ids.includes(a.id)
                                        ? ids.filter((id) => id !== a.id)
                                        : [...ids, a.id],
                                    )
                                  }
                                />
                                <span className="flex-1">{a.personName}</span>
                                {alreadyHeld && (
                                  <span className="text-[11px]">already has this lead</span>
                                )}
                              </label>
                            );
                          })}
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => setCopyOpen(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={isPending || copyTargets.length === 0}
                          onClick={copyToProfiles}
                        >
                          {isPending
                            ? "Copying…"
                            : `Apply from ${copyTargets.length || "…"} profile${copyTargets.length === 1 ? "" : "s"}`}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {(() => {
                    // Background judge's "this job also fits …" — clicking pre-checks
                    // those profiles in the multi-apply dialog. Suggestions already
                    // exclude profiles that held the job when computed; re-filter
                    // against live duplicates in case a copy happened since.
                    const suggested = selectedLead.profileSuggestions.filter(
                      (s) =>
                        s.accountId !== selectedLead.accountId &&
                        !selectedLead.duplicates.some(
                          (d) => d.profile === s.profile,
                        ),
                    );
                    if (suggested.length === 0) return null;
                    return (
                      <button
                        type="button"
                        disabled={isPending}
                        title="The judge thinks this job also fits these profiles — click to apply from them"
                        onClick={() => {
                          setCopyTargets(suggested.map((s) => s.accountId));
                          setCopyOpen(true);
                        }}
                        className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[11px] font-normal text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Sparkles className="size-3" />
                        Also fits:{" "}
                        {suggested
                          .map(
                            (s) => `${s.profile.split(" ")[0]} ${s.fitScore}%`,
                          )
                          .join(" · ")}
                      </button>
                    );
                  })()}
                  <span className="text-xs text-stone-500">
                    {selectedLead.budget}
                  </span>
                  <EnrichmentBadge
                    status={selectedLead.enrichment?.status ?? null}
                  />
                  {selectedLead.enrichment?.status === "enriched" && (
                    <SourceBadge
                      source={selectedLead.enrichment?.source ?? null}
                    />
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {enrichmentEnabled && selectedLead.sourceUrl && (
                      <button
                        type="button"
                        onClick={enrichLead}
                        disabled={isPending}
                        title="Re-fetch the job & client details from Upwork and re-score — your proposal is left as-is"
                        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 disabled:opacity-60"
                      >
                        <RefreshCw
                          className={cn(
                            "h-3.5 w-3.5",
                            isPending && "animate-spin",
                          )}
                        />
                        {selectedLead.enrichment?.status === "failed"
                          ? "Retry fetch"
                          : selectedLead.enrichment?.status
                            ? "Refresh from Upwork"
                            : "Fetch from Upwork"}
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
                  {/* Lifecycle — pulled out of the tabs so status is reachable from any tab */}
                  <div className="space-y-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Lifecycle
                      <Link
                        href="/docs#lifecycle"
                        title="What each stage means and who moves it"
                        className="rounded-full border border-stone-200 px-1.5 text-[10px] font-medium normal-case text-stone-400 transition hover:border-stone-400 hover:text-stone-600"
                      >
                        ?
                      </Link>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {leadLifecycleStatuses.map((status) => {
                        const isCurrent = selectedLead.statusCode === status;
                        const isPendingPick = pendingStatus === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={isPending || isCurrent}
                            title={stageGuide[status].meaning}
                            onClick={() =>
                              setPendingStatus(isPendingPick ? null : status)
                            }
                            className={cn(
                              "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                              isCurrent
                                ? "bg-stone-950 text-white"
                                : isPendingPick
                                  ? "border border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-200"
                                  : "border border-stone-200 bg-white text-stone-700 hover:border-stone-400",
                              isPending && "cursor-not-allowed opacity-70",
                            )}
                          >
                            {leadStatusLabelMap[status]}
                          </button>
                        );
                      })}
                    </div>
                    {pendingStatus && (
                      <div className="flex flex-wrap items-center gap-2">
                        {pendingStatus === "APPLIED" && (
                          <Input
                            inputMode="numeric"
                            value={connectsSpent}
                            onChange={(e) => setConnectsSpent(e.target.value)}
                            placeholder="Connects spent"
                            title="Logged with the application — same field as the Application tab"
                            className="h-8 w-36 text-xs"
                          />
                        )}
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            if (pendingStatus === "APPLIED") {
                              // Stamps applied-at + saves connects; the application
                              // upsert moves NEW/QUALIFIED → APPLIED itself. Leads
                              // pulled back from a later stage need the explicit move.
                              markApplied(new Date());
                              if (
                                selectedLead.statusCode !== "NEW" &&
                                selectedLead.statusCode !== "QUALIFIED"
                              ) {
                                submitStatus("APPLIED");
                              }
                            } else {
                              submitStatus(pendingStatus);
                            }
                            setPendingStatus(null);
                          }}
                        >
                          {isPending
                            ? "Applying…"
                            : `Apply — move to ${leadStatusLabelMap[pendingStatus]}`}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => setPendingStatus(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    {statusMessage && (
                      <p className="text-xs text-stone-500">{statusMessage}</p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <Tabs defaultValue="overview">
                    <TabsList className="mb-4 max-w-full overflow-x-auto">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="proposal">Proposal</TabsTrigger>
                      <TabsTrigger value="application">Application</TabsTrigger>
                      <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>

                    {/* ── Overview ── */}
                    <TabsContent value="overview" className="space-y-5 mt-0">
                      {selectedLead.duplicates.length > 0 && (
                        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                            🔁 Also matched on {selectedLead.duplicates.length} other profile
                            {selectedLead.duplicates.length > 1 ? "s" : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedLead.duplicates.map((d) => (
                              <a
                                key={d.leadId}
                                href={buildLeadUrl(d.leadId)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs text-stone-700 transition hover:border-violet-400"
                              >
                                <span className="font-medium">{d.profile}</span>
                                <span className="text-stone-500">{d.score}% · {d.status}</span>
                                {d.score > selectedLead.matchScore && (
                                  <span className="font-medium text-amber-700">· better fit ⤴</span>
                                )}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">
                            Match
                          </p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {selectedLead.matchScore}%
                          </p>
                        </div>
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">
                            Proposals
                          </p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {selectedLead.enrichment?.proposalsCount != null
                              ? selectedLead.enrichment.proposalsCount
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
                          <p className="text-[10px] uppercase tracking-widest text-stone-400">
                            Client spent
                          </p>
                          <p className="mt-1.5 text-lg font-semibold text-stone-950">
                            {selectedLead.enrichment?.client.totalSpent ?? "—"}
                          </p>
                        </div>
                      </div>

                      {/* Upwork enrichment */}
                      {selectedLead.enrichment?.status === "enriched" && (
                        <EnrichmentPanel enrichment={selectedLead.enrichment} />
                      )}
                      {selectedLead.enrichment?.status === "private" && (
                        <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm leading-6 text-amber-800">
                          This is a private / invite-only job — only the invited
                          profile can open it, so we&apos;re working from the
                          email content below.
                        </p>
                      )}
                      {selectedLead.enrichment?.status === "failed" && (
                        <p className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm leading-6 text-amber-800">
                          This job is private or no longer available — Upwork
                          isn&apos;t showing it publicly, so the full
                          description can&apos;t be fetched. Working from the
                          email content below; hit{" "}
                          <span className="font-medium">Retry fetch</span> if
                          you think it&apos;s still open.
                        </p>
                      )}

                      {/* Notes */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <StickyNote className="size-3.5 text-amber-500" />
                          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Notes
                          </p>
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
                          {selectedLead.enrichment?.description
                            ? "Job description"
                            : "Lead brief"}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">
                          <LinkifiedText
                            text={
                              (
                                selectedLead.enrichment?.description ||
                                selectedLead.brief ||
                                ""
                              ).slice(
                                0,
                                selectedLead.enrichment?.description
                                  ? 4000
                                  : 1500,
                              ) || "No lead copy captured."
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
                              <li
                                key={item}
                                className="flex gap-2 text-sm leading-6 text-stone-700"
                              >
                                <span className="mt-0.5 text-stone-400">
                                  &#8212;
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-stone-500">
                            No evaluation summary available.
                          </p>
                        )}
                        {selectedLead.rejectionReasons.length > 0 && (
                          <div className="mt-2 rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
                            <p className="text-xs font-medium text-rose-700">
                              Rejected by rules
                            </p>
                            <ul className="mt-1 space-y-0.5">
                              {selectedLead.rejectionReasons.map((r) => (
                                <li key={r} className="text-xs text-rose-600">
                                  {r}
                                </li>
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
                    </TabsContent>

                    {/* ── Proposal ── */}
                    <TabsContent value="proposal" className="space-y-4 mt-0">
                      {selectedLead.proposals.length === 0 && (
                        <ProposalEmptyState
                          status={selectedLead.enrichment?.status ?? null}
                          hasUrl={Boolean(selectedLead.sourceUrl)}
                          onGenerate={() => saveProposal("regenerate")}
                          generating={isPending}
                        />
                      )}
                      <div className="relative">
                        <Textarea
                          className="min-h-52 w-full rounded-xl border border-stone-300 bg-stone-950 p-4 pr-20 text-sm leading-6 text-stone-100 outline-none transition focus:border-stone-500 focus-visible:ring-0"
                          value={proposalDraft}
                          onChange={(e) => setProposalDraft(e.target.value)}
                          placeholder="Write your proposal here..."
                        />
                        {proposalDraft.trim() && (
                          <button
                            type="button"
                            onClick={copyProposal}
                            title="Copy proposal"
                            className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-stone-200 backdrop-blur transition hover:bg-white/20"
                          >
                            {copied ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                            {copied ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                      {selectedLead.relevantProjects.length > 0 && (
                        <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Cite these projects
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedLead.relevantProjects.map((project) => {
                              const cited = citedProjectIds.includes(project.id);
                              return (
                                <button
                                  key={project.id}
                                  type="button"
                                  onClick={() =>
                                    setCitedProjectIds((ids) =>
                                      cited ? ids.filter((id) => id !== project.id) : [...ids, project.id],
                                    )
                                  }
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                                    cited
                                      ? "border-amber-300 bg-amber-50 text-amber-900"
                                      : "border-stone-200 bg-white text-stone-500 hover:border-stone-300",
                                  )}
                                >
                                  {cited && <Check className="size-3" />}
                                  {project.title}
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[11px] leading-4 text-stone-400">
                            Highlighted projects (with their links) are woven into the next generated draft — matched
                            by tech overlap. Manage them under Profiles → Projects.
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveProposal("edit")}
                        >
                          Save as new version
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveProposal("regenerate")}
                        >
                          <RefreshCw className="mr-1.5 size-3.5" />
                          {selectedLead.proposals.length === 0
                            ? "Generate a proposal"
                            : "Regenerate from scratch"}
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
                          disabled={
                            isPending || proposalFeedback.trim().length === 0
                          }
                          onClick={() => saveProposal("regenerate")}
                        >
                          {isPending
                            ? "Rewriting…"
                            : "Rewrite with this feedback"}
                        </Button>
                      </div>
                      {statusMessage && (
                        <p className="text-xs text-stone-500">
                          {statusMessage}
                        </p>
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
                                  {proposal.isPrimary ? " · Primary" : ""}
                                </p>
                                <span className="text-xs text-stone-500">
                                  {proposal.isAiGenerated
                                    ? "AI draft"
                                    : "Manual edit"}{" "}
                                  · {proposal.createdAt}
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
                      <div className="grid gap-4 sm:grid-cols-4">
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
                          <Label htmlFor="app-connects-refunded">
                            Connects refunded
                          </Label>
                          <Input
                            id="app-connects-refunded"
                            inputMode="numeric"
                            value={connectsRefunded}
                            onChange={(e) => setConnectsRefunded(e.target.value)}
                            title="Connects Upwork returned (e.g. job closed without a hire)"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Applied at</Label>
                          {appliedAt ? (
                            <div className="flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5">
                              <Check className="size-3.5 shrink-0 text-emerald-600" />
                              <span className="flex-1 truncate text-sm text-emerald-800">
                                {formatAppliedLabel(new Date(appliedAt))}
                              </span>
                              <Popover
                                open={appliedPickerOpen}
                                onOpenChange={(open) => setAppliedPickerOpen(open)}
                              >
                                <PopoverTrigger
                                  type="button"
                                  title="Change the applied date"
                                  disabled={isPending}
                                  className="rounded p-1 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <CalendarDays className="size-3.5" />
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={new Date(appliedAt)}
                                    disabled={{ after: new Date() }}
                                    onSelect={(d) => {
                                      if (d) markApplied(dayAtNoon(d));
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                              <button
                                type="button"
                                title="Clear the applied date"
                                onClick={clearApplied}
                                disabled={isPending}
                                className="rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => markApplied(new Date())}
                                className="gap-1.5"
                              >
                                <Check className="size-3.5" />
                                Mark applied
                              </Button>
                              <Popover
                                open={appliedPickerOpen}
                                onOpenChange={(open) => setAppliedPickerOpen(open)}
                              >
                                <PopoverTrigger
                                  type="button"
                                  title="Pick a specific date"
                                  disabled={isPending}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-2.5 text-xs text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                                >
                                  <CalendarDays className="size-3.5" />
                                  Custom
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    disabled={{ after: new Date() }}
                                    onSelect={(d) => {
                                      if (d) markApplied(dayAtNoon(d));
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="app-followup-at">
                            Last follow-up
                          </Label>
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

                      <Separator />

                      {/* ── Sent proposal + manager review ── */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="app-sent-proposal">
                            Proposal used to apply
                          </Label>
                          {proposalDraft.trim() && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => setSentProposal(proposalDraft)}
                              className="text-xs text-amber-700 transition hover:text-amber-800 disabled:opacity-50"
                              title="Copy the current draft from the Proposal tab into this field"
                            >
                              Copy from current draft
                            </button>
                          )}
                        </div>
                        <Textarea
                          id="app-sent-proposal"
                          rows={7}
                          value={sentProposal}
                          onChange={(e) => setSentProposal(e.target.value)}
                          placeholder="Paste the proposal exactly as it was submitted on Upwork — so managers review what the client actually saw."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="app-sent-feedback">
                          Manager feedback on the sent proposal
                        </Label>
                        <Textarea
                          id="app-sent-feedback"
                          rows={3}
                          value={sentFeedback}
                          onChange={(e) => setSentFeedback(e.target.value)}
                          placeholder="Managers: what should BD do differently next time? Shows in Activity with your name."
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={buReviewed}
                            onChange={(e) =>
                              void saveReviewToggle(
                                "buReviewed",
                                e.target.checked,
                              )
                            }
                            className="size-4 accent-amber-600"
                          />
                          BU reviewed
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={proposalViewed}
                            onChange={(e) =>
                              void saveReviewToggle(
                                "proposalViewed",
                                e.target.checked,
                              )
                            }
                            className="size-4 accent-amber-600"
                          />
                          Proposal viewed
                        </label>
                        <span className="text-xs text-stone-400">
                          Toggles save instantly, with your name in Activity.
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={submitApplication}
                        >
                          {isPending ? "Saving..." : "Save application"}
                        </Button>
                        {selectedLead.application && (
                          <p className="text-xs text-stone-500">
                            Last saved {selectedLead.application.updatedAt}
                          </p>
                        )}
                      </div>
                      {statusMessage && (
                        <p className="text-xs text-stone-500">
                          {statusMessage}
                        </p>
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
