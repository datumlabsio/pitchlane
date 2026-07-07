'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProfileStatView } from '@/domain/profile-stats/types';

// Monday of the week containing `d`, as yyyy-MM-dd (UTC).
function mondayOf(d: Date): string {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0 Sun … 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  utc.setUTCDate(utc.getUTCDate() - diff);
  return utc.toISOString().slice(0, 10);
}

function formatWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

type StatForm = { weekStart: string; views: string; invites: string; impressions: string; clicks: string };

function emptyForm(): StatForm {
  return { weekStart: mondayOf(new Date()), views: '', invites: '', impressions: '', clicks: '' };
}

const NUM_FIELDS: { key: keyof Omit<StatForm, 'weekStart'>; label: string }[] = [
  { key: 'views', label: 'Profile views' },
  { key: 'invites', label: 'Invites' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
];

export function ProfileStatsPanel({
  accountId,
  stats: initialStats,
}: {
  accountId: string;
  stats: ProfileStatView[];
}) {
  const router = useRouter();
  const [stats, setStats] = useState(initialStats);
  const [form, setForm] = useState<StatForm>(emptyForm);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');

  const editingExisting = stats.some((s) => s.weekStart === form.weekStart);

  function setField(key: keyof StatForm, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
    // Prefill the number fields when the chosen week already has a row.
    if (key === 'weekStart') {
      const existing = stats.find((s) => s.weekStart === value);
      if (existing) {
        setForm({
          weekStart: value,
          views: String(existing.views),
          invites: String(existing.invites),
          impressions: String(existing.impressions),
          clicks: String(existing.clicks),
        });
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus('');
    const num = (v: string) => (v.trim() === '' ? 0 : Number(v));
    try {
      const res = await fetch('/api/profile-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          weekStart: form.weekStart,
          views: num(form.views),
          invites: num(form.invites),
          impressions: num(form.impressions),
          clicks: num(form.clicks),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setStatus(data.error || 'Save failed.'); return; }
      const saved = data.stat as ProfileStatView;
      setStats((list) => {
        const rest = list.filter((s) => s.weekStart !== saved.weekStart);
        return [saved, ...rest].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
      });
      setStatus('Saved.');
      setForm(emptyForm());
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPending(false);
    }
  }

  async function remove(stat: ProfileStatView) {
    const res = await fetch(`/api/profile-stats/${stat.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      setStats((list) => list.filter((s) => s.id !== stat.id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-stone-900">Weekly Upwork stats</p>
        <p className="mt-0.5 text-xs text-stone-500">
          Upwork doesn’t expose these by date, so enter them manually each week. Saving a week that already exists
          overwrites it. Feeds the visibility charts on Metrics.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="ps-week">Week starting</Label>
            <Input id="ps-week" type="date" value={form.weekStart} onChange={(e) => setField('weekStart', e.target.value)} required />
          </div>
          {NUM_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`ps-${key}`}>{label}</Label>
              <Input
                id={`ps-${key}`}
                type="number"
                min={0}
                value={form[key]}
                onChange={(e) => setField(key, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Saving…' : editingExisting ? 'Update week' : 'Add week'}
          </Button>
          {status && (
            <span className={`text-xs ${status === 'Saved.' ? 'text-emerald-700' : 'text-rose-600'}`}>{status}</span>
          )}
        </div>
      </form>

      {stats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-6 text-center">
          <p className="text-sm text-stone-600">No weekly stats yet.</p>
          <p className="mt-1 text-xs text-stone-500">Add this week’s numbers from the Upwork profile page.</p>
        </div>
      ) : (
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="bg-stone-50/60">
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Invites</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{formatWeek(s.weekStart)}</TableCell>
                <TableCell className="text-right tabular-nums">{s.views}</TableCell>
                <TableCell className="text-right tabular-nums">{s.invites}</TableCell>
                <TableCell className="text-right tabular-nums">{s.impressions}</TableCell>
                <TableCell className="text-right tabular-nums">{s.clicks}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="h-7 px-2 text-stone-400 hover:text-rose-600" title="Delete" />}>
                      <Trash2 className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {formatWeek(s.weekStart)}?</AlertDialogTitle>
                        <AlertDialogDescription>Removes this week’s stats for this profile.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(s)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
