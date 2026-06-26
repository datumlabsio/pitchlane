'use client';

import { useState } from 'react';

type SyncResult = {
  status: string;
  messagesScanned: number;
  leadsCreated: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errorSummary: string | null;
};

type Props = {
  connected: boolean;
  hasModifyScope: boolean;
  slackMinScore: number;
};

export function GmailSyncForm({
  connected,
  hasModifyScope,
  slackMinScore: initialSlackScore,
}: Props) {
  const [syncPending, setSyncPending] = useState(false);
  const [labelPending, setLabelPending] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [labelDone, setLabelDone] = useState(false);
  const [slackScore, setSlackScore] = useState(initialSlackScore);
  const [savedSlackScore, setSavedSlackScore] = useState(initialSlackScore);
  const [slackSaving, setSlackSaving] = useState(false);
  const [error, setError] = useState('');

  const canAct = connected && hasModifyScope;

  async function onSync() {
    setSyncPending(true);
    setError('');
    setSyncResult(null);
    try {
      const res = await fetch('/api/integrations/gmail/sync', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || !payload.ok) { setError(payload.error || 'Sync failed'); return; }
      setSyncResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncPending(false);
    }
  }

  async function onSetupLabels() {
    setLabelPending(true);
    setError('');
    setLabelDone(false);
    try {
      const res = await fetch('/api/integrations/gmail/setup-labels', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || !payload.ok) { setError(payload.error || 'Label setup failed'); return; }
      setLabelDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Label setup failed');
    } finally {
      setLabelPending(false);
    }
  }

  async function onSaveSlackScore(score: number) {
    setSlackSaving(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/gmail/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slackMinScore: score }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) { setError(payload.error || 'Failed to save threshold'); return; }
      setSavedSlackScore(score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save threshold');
    } finally {
      setSlackSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {connected && !hasModifyScope && (
        <p className="text-xs text-amber-400">
          Read-only access. Reconnect Gmail to grant full access for label management.
        </p>
      )}

      {/* Slack alert threshold */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-stone-400 shrink-0">🟢 Hot lead threshold</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={slackScore}
            onChange={(e) => setSlackScore(Math.max(0, Math.min(100, Math.round(Number(e.target.value)) || 0)))}
            className="w-20 rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-white/30"
          />
          <span className="text-xs text-stone-500">% match</span>
          {slackScore !== savedSlackScore ? (
            <button
              type="button"
              disabled={slackSaving}
              onClick={() => onSaveSlackScore(slackScore)}
              className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-medium text-stone-950 transition hover:bg-amber-300 disabled:opacity-50"
            >
              {slackSaving ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <span className="text-xs text-stone-500">· saved</span>
          )}
        </div>
      </div>
      <p className="text-xs text-stone-500">
        Leads scoring above 30% Match are posted to Slack once enrichment finishes; lower ones are skipped. Those at or above this threshold are flagged 🟢 hot (others ⚪). Default 40%.
      </p>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canAct || labelPending}
          onClick={onSetupLabels}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-stone-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {labelPending ? 'Setting up…' : labelDone ? '✓ Labels ready' : 'Setup Gmail labels'}
        </button>
        <button
          type="button"
          disabled={!canAct || syncPending}
          onClick={onSync}
          className="rounded-full bg-white px-4 py-2 text-xs font-medium text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncPending ? 'Syncing…' : 'Run sync now'}
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {syncResult && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Scanned', value: syncResult.messagesScanned },
            { label: 'Created', value: syncResult.leadsCreated },
            { label: 'Dupes', value: syncResult.duplicatesSkipped },
            { label: 'Errors', value: syncResult.errorsCount },
          ].map((m) => (
            <div key={m.label} className="rounded-xl bg-white/8 px-3 py-2 text-center">
              <p className="text-lg font-semibold text-white">{m.value}</p>
              <p className="text-xs text-stone-400">{m.label}</p>
            </div>
          ))}
          {syncResult.errorSummary && (
            <p className="col-span-4 text-xs text-amber-300">{syncResult.errorSummary}</p>
          )}
        </div>
      )}
    </div>
  );
}
