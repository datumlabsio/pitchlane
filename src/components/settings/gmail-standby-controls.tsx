'use client';

import { useState } from 'react';

type SyncResult = {
  leadsCreated: number;
  duplicatesSkipped: number;
  errorsCount: number;
  errorSummary: string | null;
};

// One-shot manual Gmail pull — the rollback lever. In live inbound mode the sync
// route deliberately does NOT re-arm the push watch, so this stays a single pull.
export function GmailStandbyControls({ connected }: { connected: boolean }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  async function onSync() {
    setPending(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/integrations/gmail/sync', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload.error || 'Sync failed');
        return;
      }
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!connected || pending}
        onClick={onSync}
        className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Pulling…' : 'One-shot pull'}
      </button>
      {result && (
        <span className="text-xs text-stone-500">
          {result.leadsCreated} new · {result.duplicatesSkipped} dupes
          {result.errorsCount > 0 ? ` · ${result.errorsCount} errors` : ''}
        </span>
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
