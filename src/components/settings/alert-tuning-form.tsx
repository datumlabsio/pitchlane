'use client';

import { useState } from 'react';

type Props = {
  slackMinScore: number;
  slackAlertFloor: number;
};

type FieldKey = 'slackMinScore' | 'slackAlertFloor';

// Slack alert tuning — persisted on the integration connection via the settings
// endpoint. Pure threshold controls; nothing here touches ingestion.
export function AlertTuningForm({ slackMinScore, slackAlertFloor }: Props) {
  const [values, setValues] = useState({ slackMinScore, slackAlertFloor });
  const [saved, setSaved] = useState({ slackMinScore, slackAlertFloor });
  const [saving, setSaving] = useState<FieldKey | null>(null);
  const [error, setError] = useState('');

  async function save(field: FieldKey) {
    setSaving(field);
    setError('');
    try {
      const res = await fetch('/api/integrations/gmail/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: values[field] }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload.error || 'Failed to save');
        return;
      }
      setSaved((prev) => ({ ...prev, [field]: values[field] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  const fields: Array<{ key: FieldKey; icon: string; label: string; hint: string }> = [
    { key: 'slackMinScore', icon: '🟢', label: 'Hot lead threshold', hint: 'controls the 🟢/⚪ dot on alerts' },
    { key: 'slackAlertFloor', icon: '🔕', label: 'Alert floor', hint: 'qualified leads below this stay out of Slack' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, icon, label, hint }) => (
          <div key={key} className="rounded-2xl border border-stone-900/8 bg-stone-50 p-4">
            <p className="text-xs font-medium text-stone-500">
              {icon} {label}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={values[key]}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [key]: Math.max(0, Math.min(100, Math.round(Number(e.target.value)) || 0)),
                  }))
                }
                className="w-20 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <span className="text-xs text-stone-500">% match</span>
              {values[key] !== saved[key] ? (
                <button
                  type="button"
                  disabled={saving === key}
                  onClick={() => save(key)}
                  className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-medium text-stone-950 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {saving === key ? 'Saving…' : 'Save'}
                </button>
              ) : (
                <span className="text-xs text-stone-400">saved</span>
              )}
            </div>
            <p className="mt-2 text-xs text-stone-400">{hint}</p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-stone-500">
        Every lead the judge qualifies is posted to Slack; rejected leads never are. At floor 0 all
        qualified leads alert. Re-enrichment, stale emails (24h+), and same-job siblings stay quiet.
      </p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
