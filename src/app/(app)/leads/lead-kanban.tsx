'use client';

import { useState } from 'react';
import { CheckCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  leadStatusLabelMap,
  type LeadStatusCode,
  type LeadSummary,
} from '@/domain/leads/types';

// Pipeline order first, terminals after. NEW is transient (auto-triage drains it) —
// its column only appears while something is passing through, and can't be a drop
// target (the status API refuses moves back to NEW).
const COLUMNS: Array<{ code: LeadStatusCode; dot: string; droppable: boolean }> = [
  { code: 'NEW', dot: 'bg-stone-400', droppable: false },
  { code: 'QUALIFIED', dot: 'bg-emerald-500', droppable: true },
  { code: 'APPLIED', dot: 'bg-amber-500', droppable: true },
  { code: 'CLIENT_REPLIED', dot: 'bg-amber-600', droppable: true },
  { code: 'INTRO_CALL', dot: 'bg-sky-500', droppable: true },
  { code: 'ONGOING_DISCUSSION', dot: 'bg-sky-600', droppable: true },
  { code: 'WON', dot: 'bg-emerald-600', droppable: true },
  { code: 'LOST', dot: 'bg-rose-500', droppable: true },
  { code: 'HIRES_OTHER', dot: 'bg-slate-400', droppable: true },
  { code: 'JOB_CLOSED', dot: 'bg-slate-500', droppable: true },
  { code: 'REJECTED', dot: 'bg-rose-400', droppable: true },
];

function scoreTint(score: number) {
  if (score >= 70) return 'bg-emerald-50 text-emerald-700';
  if (score >= 40) return 'bg-amber-50 text-amber-700';
  return 'bg-stone-100 text-stone-500';
}

export function LeadKanban({
  leads,
  busy,
  onOpenLead,
  onMoveLead,
  onApplyLead,
}: {
  leads: LeadSummary[];
  busy?: boolean;
  onOpenLead: (leadId: string) => void;
  /** Plain status move (everything except drops onto Applied). */
  onMoveLead: (leadId: string, to: LeadStatusCode) => void;
  /** Drop onto Applied: logs appliedAt=now (+ optional connects), promoting the lead. */
  onApplyLead: (leadId: string, connects: number | null, fromStatus: LeadStatusCode) => void;
}) {
  // Optimistic card placement — cleared whenever the server sends fresh leads
  // (reset-during-render, keyed on the incoming array identity).
  const [moves, setMoves] = useState<Record<string, LeadStatusCode>>({});
  const [movesFor, setMovesFor] = useState(leads);
  if (movesFor !== leads) {
    setMovesFor(leads);
    setMoves({});
  }
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatusCode | null>(null);
  // Drop-on-Applied confirm: capture connects before committing (same nudge as the
  // lifecycle Apply flow — connect costs shouldn't be lost to a quick drag).
  const [applyDrop, setApplyDrop] = useState<{ leadId: string; from: LeadStatusCode } | null>(null);
  const [applyConnects, setApplyConnects] = useState('');

  const statusOf = (lead: LeadSummary) => moves[lead.id] ?? lead.statusCode;
  const byColumn = new Map<LeadStatusCode, LeadSummary[]>(
    COLUMNS.map((c) => [c.code, [] as LeadSummary[]]),
  );
  for (const lead of leads) {
    byColumn.get(statusOf(lead))?.push(lead);
  }

  function handleDrop(to: LeadStatusCode) {
    setDropTarget(null);
    if (!dragging) return;
    const lead = leads.find((l) => l.id === dragging);
    setDragging(null);
    if (!lead) return;
    const from = statusOf(lead);
    if (from === to) return;
    if (to === 'APPLIED') {
      setApplyConnects('');
      setApplyDrop({ leadId: lead.id, from });
      return; // committed from the dialog
    }
    setMoves((m) => ({ ...m, [lead.id]: to }));
    onMoveLead(lead.id, to);
  }

  function commitApplyDrop() {
    if (!applyDrop) return;
    const parsed = applyConnects.trim().length > 0 ? Number(applyConnects) : null;
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) return;
    setMoves((m) => ({ ...m, [applyDrop.leadId]: 'APPLIED' }));
    onApplyLead(applyDrop.leadId, parsed, applyDrop.from);
    setApplyDrop(null);
  }

  const visibleColumns = COLUMNS.filter(
    (c) => c.code !== 'NEW' || (byColumn.get('NEW')?.length ?? 0) > 0,
  );

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {visibleColumns.map((col) => {
          const cards = byColumn.get(col.code) ?? [];
          return (
            <div
              key={col.code}
              className={cn(
                'flex w-64 shrink-0 flex-col rounded-xl border bg-stone-50/60 transition',
                dropTarget === col.code && col.droppable && dragging
                  ? 'border-amber-400 bg-amber-50/60'
                  : 'border-stone-200',
              )}
              onDragOver={(e) => {
                if (!col.droppable) return;
                e.preventDefault();
                setDropTarget(col.code);
              }}
              onDragLeave={() => setDropTarget((t) => (t === col.code ? null : t))}
              onDrop={(e) => {
                if (!col.droppable) return;
                e.preventDefault();
                handleDrop(col.code);
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className={cn('size-2 rounded-full', col.dot)} />
                <p className="text-xs font-semibold text-stone-700">
                  {leadStatusLabelMap[col.code]}
                </p>
                <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[10px] tabular-nums text-stone-500">
                  {cards.length}
                </span>
              </div>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
                {cards.map((lead) => (
                  <div
                    key={lead.id}
                    draggable={!busy}
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    onClick={() => onOpenLead(lead.id)}
                    className={cn(
                      'cursor-grab rounded-lg border border-stone-200 bg-white p-2.5 shadow-xs transition hover:border-stone-300',
                      dragging === lead.id && 'opacity-50',
                    )}
                  >
                    <p className="line-clamp-2 text-xs font-medium leading-4 text-stone-800">
                      {lead.title}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                        {lead.profileName.split(' ')[0]}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                          scoreTint(lead.matchScore),
                        )}
                      >
                        {lead.matchScore}%
                      </span>
                      {lead.proposalViewed !== null && (
                        <CheckCheck
                          strokeWidth={2.5}
                          className={cn(
                            'size-3.5 shrink-0',
                            lead.proposalViewed ? 'text-emerald-500' : 'text-stone-300',
                          )}
                        >
                          <title>
                            {lead.proposalViewed
                              ? 'Client viewed the proposal'
                              : 'Not viewed by the client yet'}
                          </title>
                        </CheckCheck>
                      )}
                      <span className="ml-auto truncate text-[10px] text-stone-400">
                        {lead.createdAt}
                      </span>
                    </div>
                  </div>
                ))}
                {cards.length === 0 && (
                  <div className="rounded-lg border border-dashed border-stone-200 py-4 text-center text-[11px] text-stone-400">
                    {col.droppable ? 'Drop here' : 'Empty'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={applyDrop !== null} onOpenChange={(open) => !open && setApplyDrop(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as applied</DialogTitle>
          </DialogHeader>
          <p className="text-xs leading-5 text-stone-500">
            Logs the application as sent just now. Add the connects it cost — the
            costing metrics depend on it.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="kanban-apply-connects">Connects spent (optional)</Label>
            <Input
              id="kanban-apply-connects"
              inputMode="numeric"
              value={applyConnects}
              onChange={(e) => setApplyConnects(e.target.value)}
              placeholder="e.g. 16"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setApplyDrop(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={commitApplyDrop}>
              Mark applied
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
