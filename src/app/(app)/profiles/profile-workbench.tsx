'use client';

import { ProposalTone } from '@/domain/enums';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { AccountSettingsView } from '@/domain/accounts/types';
import type { EditableProfileView, ProfileConfigView, ScoringWeights } from '@/domain/profiles/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const proposalToneOptions: { value: ProposalTone; label: string }[] = [
  { value: ProposalTone.CONSULTATIVE, label: 'Consultative' },
  { value: ProposalTone.DIRECT, label: 'Direct' },
  { value: ProposalTone.EXPERT, label: 'Expert' },
  { value: ProposalTone.FRIENDLY, label: 'Friendly' },
];

function listToMultiline(values: string[]) {
  return values.join('\n');
}
function multilineToList(value: string) {
  return value.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean);
}

type WeightsForm = { skillMatch: string; roleFit: string; keywordMatch: string; budgetFit: string; confidence: string };
type AccountForm = { gmailLabel: string; forwardingInbox: string; notificationEmail: string; isActive: boolean };
type ProfileForm = {
  isActive: boolean; roleFocus: string; jdSummary: string; targetRoles: string; targetKeywords: string;
  requiredSkills: string; niceToHaveSkills: string; rejectRules: string; budgetPreference: string;
  scoreThreshold: string; proposalTone: ProposalTone; proposalRules: string; reusableSnippets: string;
  scoringWeights: WeightsForm;
};

function initAccountForm(a: AccountSettingsView): AccountForm {
  return { gmailLabel: a.gmailLabel, forwardingInbox: a.forwardingInbox, notificationEmail: a.notificationEmail ?? '', isActive: a.isActive };
}
function initProfileForm(cfg: ProfileConfigView): ProfileForm {
  const w = (cfg.scoringWeights ?? {}) as Partial<ScoringWeights>;
  return {
    isActive: cfg.isActive, roleFocus: cfg.roleFocus, jdSummary: cfg.jdSummary,
    targetRoles: listToMultiline(cfg.targetRoles), targetKeywords: listToMultiline(cfg.targetKeywords),
    requiredSkills: listToMultiline(cfg.requiredSkills), niceToHaveSkills: listToMultiline(cfg.niceToHaveSkills),
    rejectRules: listToMultiline(cfg.rejectRules), budgetPreference: cfg.budgetPreference ?? '',
    scoreThreshold: String(cfg.scoreThreshold), proposalTone: cfg.proposalTone,
    proposalRules: listToMultiline(cfg.proposalRules), reusableSnippets: listToMultiline(cfg.reusableSnippets),
    scoringWeights: {
      skillMatch: String(w.skillMatch ?? 0.35), roleFit: String(w.roleFit ?? 0.25),
      keywordMatch: String(w.keywordMatch ?? 0.2), budgetFit: String(w.budgetFit ?? 0.1), confidence: String(w.confidence ?? 0.1),
    },
  };
}

function FieldRow({ label, hint, id, children }: { label: string; hint?: string; id?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-stone-800">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function SaveStatus({ status, pending }: { status: string; pending: boolean }) {
  if (!status && !pending) return null;
  const isError = status && !status.includes('saved');
  return <p className={`text-xs ${isError ? 'text-rose-600' : 'text-emerald-700'}`}>{pending ? '…' : status}</p>;
}

// ─── sheet content ─────────────────────────────────────────────────────────────

function ProfileSheetContent({ entry }: { entry: EditableProfileView }) {
  const [accountForm, setAccountForm] = useState(() => initAccountForm(entry.account));
  const [currentConfig, setCurrentConfig] = useState(entry.profileConfig);
  const [profileForm, setProfileForm] = useState(() => entry.profileConfig ? initProfileForm(entry.profileConfig) : null);
  const [accountPending, setAccountPending] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [accountStatus, setAccountStatus] = useState('');
  const [profileStatus, setProfileStatus] = useState('');

  const weightsSum = useMemo(() => {
    if (!profileForm) return null;
    const s = Object.values(profileForm.scoringWeights).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
    return Math.round(s * 100) / 100;
  }, [profileForm]);

  function setWeight(key: keyof WeightsForm, value: string) {
    setProfileForm((c) => c ? { ...c, scoringWeights: { ...c.scoringWeights, [key]: value } } : c);
  }

  async function saveAccount() {
    setAccountPending(true); setAccountStatus('');
    try {
      const res = await fetch(`/api/accounts/${entry.account.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accountForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setAccountStatus(data.error || 'Save failed'); return; }
      setAccountStatus('Account saved.');
      setAccountForm(initAccountForm(data.account as AccountSettingsView));
    } catch (e) { setAccountStatus(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setAccountPending(false); }
  }

  async function saveProfile() {
    if (!currentConfig || !profileForm) return;
    setProfilePending(true); setProfileStatus('');
    const threshold = parseInt(profileForm.scoreThreshold, 10);
    try {
      const res = await fetch(`/api/profile-configs/${currentConfig.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: profileForm.isActive, roleFocus: profileForm.roleFocus, jdSummary: profileForm.jdSummary,
          targetRoles: multilineToList(profileForm.targetRoles), targetKeywords: multilineToList(profileForm.targetKeywords),
          requiredSkills: multilineToList(profileForm.requiredSkills), niceToHaveSkills: multilineToList(profileForm.niceToHaveSkills),
          rejectRules: multilineToList(profileForm.rejectRules), budgetPreference: profileForm.budgetPreference,
          scoreThreshold: isNaN(threshold) ? 70 : threshold, proposalTone: profileForm.proposalTone,
          proposalRules: multilineToList(profileForm.proposalRules), reusableSnippets: multilineToList(profileForm.reusableSnippets),
          scoringWeights: {
            skillMatch: parseFloat(profileForm.scoringWeights.skillMatch) || 0.35,
            roleFit: parseFloat(profileForm.scoringWeights.roleFit) || 0.25,
            keywordMatch: parseFloat(profileForm.scoringWeights.keywordMatch) || 0.2,
            budgetFit: parseFloat(profileForm.scoringWeights.budgetFit) || 0.1,
            confidence: parseFloat(profileForm.scoringWeights.confidence) || 0.1,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setProfileStatus(data.error || 'Save failed'); return; }
      setProfileStatus('Config saved.');
      setCurrentConfig(data.profileConfig as ProfileConfigView);
      setProfileForm(initProfileForm(data.profileConfig as ProfileConfigView));
    } catch (e) { setProfileStatus(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setProfilePending(false); }
  }

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-stone-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-base font-semibold text-amber-800">
            {entry.account.personName[0]}
          </div>
          <div>
            <SheetTitle className="text-base">{entry.account.personName}</SheetTitle>
            <p className="text-xs text-stone-500">{entry.account.gmailLabel}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className={accountForm.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-500'}>
              {accountForm.isActive ? 'Active' : 'Paused'}
            </Badge>
            {currentConfig && (
              <Badge variant="outline" className={profileForm?.isActive ? 'border-amber-200 bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-500'}>
                Config v{currentConfig.version}
              </Badge>
            )}
          </div>
        </div>
      </SheetHeader>

      <Tabs defaultValue="qualification" className="flex flex-1 min-h-0 flex-col">
        <TabsList className="mx-6 mt-4 w-fit shrink-0">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="qualification">Qualification</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 min-h-0">
          {/* ─── Account ─── */}
          <TabsContent value="account" className="m-0 px-6 py-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="Gmail label" id="gl">
                <Input id="gl" value={accountForm.gmailLabel} onChange={(e) => setAccountForm((c) => ({ ...c, gmailLabel: e.target.value }))} />
              </FieldRow>
              <FieldRow label="Forwarding inbox" id="fi">
                <Input id="fi" type="email" value={accountForm.forwardingInbox} onChange={(e) => setAccountForm((c) => ({ ...c, forwardingInbox: e.target.value }))} />
              </FieldRow>
              <FieldRow label="Notification email" hint="Leave blank to disable." id="ne">
                <Input id="ne" type="email" value={accountForm.notificationEmail} onChange={(e) => setAccountForm((c) => ({ ...c, notificationEmail: e.target.value }))} />
              </FieldRow>
              <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
                <div>
                  <Label htmlFor="ia" className="text-stone-900">Account active</Label>
                  <p className="mt-0.5 text-xs text-stone-500">Disable to pause without deleting.</p>
                </div>
                <Switch id="ia" checked={accountForm.isActive} onCheckedChange={(v) => setAccountForm((c) => ({ ...c, isActive: v }))} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button size="sm" disabled={accountPending} onClick={saveAccount}>{accountPending ? 'Saving…' : 'Save account'}</Button>
              <SaveStatus status={accountStatus} pending={accountPending} />
            </div>
          </TabsContent>

          {/* ─── Qualification ─── */}
          <TabsContent value="qualification" className="m-0 px-6 py-5 space-y-4">
            {profileForm ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldRow label="Role focus" id="rf">
                    <Input id="rf" value={profileForm.roleFocus} onChange={(e) => setProfileForm((c) => c ? { ...c, roleFocus: e.target.value } : c)} />
                  </FieldRow>
                  <FieldRow label="Score threshold" hint="Min score (0–100) to auto-qualify." id="st">
                    <Input id="st" type="number" min={0} max={100} value={profileForm.scoreThreshold} onChange={(e) => setProfileForm((c) => c ? { ...c, scoreThreshold: e.target.value } : c)} />
                  </FieldRow>
                </div>
                <FieldRow label="JD summary" hint="Positioning context for proposal generation.">
                  <Textarea rows={3} value={profileForm.jdSummary} onChange={(e) => setProfileForm((c) => c ? { ...c, jdSummary: e.target.value } : c)} />
                </FieldRow>
                <FieldRow label="Budget preference" hint="Budget context used in scoring.">
                  <Input value={profileForm.budgetPreference} onChange={(e) => setProfileForm((c) => c ? { ...c, budgetPreference: e.target.value } : c)} />
                </FieldRow>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldRow label="Target roles" hint="One per line.">
                    <Textarea rows={4} value={profileForm.targetRoles} onChange={(e) => setProfileForm((c) => c ? { ...c, targetRoles: e.target.value } : c)} />
                  </FieldRow>
                  <FieldRow label="Target keywords" hint="One per line.">
                    <Textarea rows={4} value={profileForm.targetKeywords} onChange={(e) => setProfileForm((c) => c ? { ...c, targetKeywords: e.target.value } : c)} />
                  </FieldRow>
                  <FieldRow label="Required skills" hint="Must match at least one.">
                    <Textarea rows={4} value={profileForm.requiredSkills} onChange={(e) => setProfileForm((c) => c ? { ...c, requiredSkills: e.target.value } : c)} />
                  </FieldRow>
                  <FieldRow label="Nice-to-have skills" hint="Each adds bonus score.">
                    <Textarea rows={4} value={profileForm.niceToHaveSkills} onChange={(e) => setProfileForm((c) => c ? { ...c, niceToHaveSkills: e.target.value } : c)} />
                  </FieldRow>
                </div>
                <FieldRow label="Reject rules" hint="Hard disqualifiers — any match rejects the lead.">
                  <Textarea rows={3} value={profileForm.rejectRules} onChange={(e) => setProfileForm((c) => c ? { ...c, rejectRules: e.target.value } : c)} />
                </FieldRow>
                <div className="flex items-center gap-3 pt-2">
                  <Button size="sm" disabled={profilePending} onClick={saveProfile}>{profilePending ? 'Saving…' : 'Save config'}</Button>
                  <SaveStatus status={profileStatus} pending={profilePending} />
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-500">No profile config linked yet.</p>
            )}
          </TabsContent>

          {/* ─── Scoring ─── */}
          <TabsContent value="scoring" className="m-0 px-6 py-5 space-y-5">
            {profileForm ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">Scoring weights</p>
                      <p className="text-xs text-stone-500 mt-0.5">Each weight controls how much that signal contributes to the final score. Should sum to 1.0.</p>
                    </div>
                    <span className={`text-xs font-medium tabular-nums ${weightsSum === 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Sum: {weightsSum} {weightsSum !== 1 ? '(≠ 1.0)' : '✓'}
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      ['skillMatch', 'Skill match', 'How much required skill coverage matters'],
                      ['roleFit', 'Role fit', 'How much matching job titles matters'],
                      ['keywordMatch', 'Keywords', 'How much keyword overlap matters'],
                      ['budgetFit', 'Budget fit', 'How much budget alignment matters'],
                      ['confidence', 'Confidence', 'How much email completeness matters'],
                    ] as [keyof WeightsForm, string, string][]).map(([key, label, hint]) => (
                      <FieldRow key={key} label={label} hint={hint}>
                        <Input
                          type="number" min={0} max={1} step={0.05}
                          value={profileForm.scoringWeights[key]}
                          onChange={(e) => setWeight(key, e.target.value)}
                        />
                      </FieldRow>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button size="sm" disabled={profilePending} onClick={saveProfile}>{profilePending ? 'Saving…' : 'Save config'}</Button>
                  <SaveStatus status={profileStatus} pending={profilePending} />
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-500">No profile config linked yet.</p>
            )}
          </TabsContent>

          {/* ─── Proposal ─── */}
          <TabsContent value="proposal" className="m-0 px-6 py-5 space-y-4">
            {profileForm ? (
              <>
                <div className="flex flex-wrap items-end gap-5">
                  <FieldRow label="Proposal tone">
                    <Select value={profileForm.proposalTone} onValueChange={(v) => setProfileForm((c) => c ? { ...c, proposalTone: v as ProposalTone } : c)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {proposalToneOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <div className="flex items-center gap-2 pb-0.5">
                    <Switch
                      id="ca"
                      checked={profileForm.isActive}
                      onCheckedChange={(v) => setProfileForm((c) => c ? { ...c, isActive: v } : c)}
                    />
                    <Label htmlFor="ca" className="text-sm text-stone-700">Config active</Label>
                  </div>
                </div>
                <Separator />
                <FieldRow label="Proposal rules" hint="Instructions the AI always follows when writing.">
                  <Textarea rows={5} value={profileForm.proposalRules} onChange={(e) => setProfileForm((c) => c ? { ...c, proposalRules: e.target.value } : c)} />
                </FieldRow>
                <FieldRow label="Reusable snippets" hint="Atomic phrases injected into generated drafts.">
                  <Textarea rows={5} value={profileForm.reusableSnippets} onChange={(e) => setProfileForm((c) => c ? { ...c, reusableSnippets: e.target.value } : c)} />
                </FieldRow>
                <div className="flex items-center gap-3 pt-2">
                  <Button size="sm" disabled={profilePending} onClick={saveProfile}>{profilePending ? 'Saving…' : 'Save config'}</Button>
                  <SaveStatus status={profileStatus} pending={profilePending} />
                </div>
              </>
            ) : (
              <p className="text-sm text-stone-500">No profile config linked yet.</p>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ─── main workbench ────────────────────────────────────────────────────────────

type WorkbenchProps = {
  profiles: EditableProfileView[];
  selectedProfile: EditableProfileView | null;
};

const toneColors: Record<ProposalTone, string> = {
  CONSULTATIVE: 'bg-blue-50 text-blue-700 border-blue-200',
  DIRECT: 'bg-stone-100 text-stone-700',
  EXPERT: 'bg-purple-50 text-purple-700 border-purple-200',
  FRIENDLY: 'bg-amber-50 text-amber-700 border-amber-200',
};
const toneLabels: Record<ProposalTone, string> = {
  CONSULTATIVE: 'Consultative', DIRECT: 'Direct', EXPERT: 'Expert', FRIENDLY: 'Friendly',
};

const EMPTY_FORM = {
  personName: '',
  gmailLabel: '',
  forwardingInbox: '',
  notificationEmail: '',
  roleFocus: '',
  targetKeywords: '',
  requiredSkills: '',
  rejectRules: '',
};

function splitTags(s: string) {
  return s.split(',').map((t) => t.trim()).filter(Boolean);
}

function NewProfileDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  function setField(key: keyof typeof form, value: string) {
    if (key === 'personName') {
      setForm((c) => ({
        ...c,
        personName: value,
        gmailLabel: c.gmailLabel || `pitchlane/${value.toLowerCase().replace(/\s+/g, '-')}`,
      }));
    } else {
      setForm((c) => ({ ...c, [key]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus('');
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personName: form.personName,
          gmailLabel: form.gmailLabel,
          forwardingInbox: form.forwardingInbox,
          notificationEmail: form.notificationEmail,
          roleFocus: form.roleFocus,
          targetKeywords: splitTags(form.targetKeywords),
          requiredSkills: splitTags(form.requiredSkills),
          rejectRules: splitTags(form.rejectRules),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(data.error || 'Failed to create profile.');
        return;
      }
      setOpen(false);
      setForm(EMPTY_FORM);
      onSuccess();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <Plus className="h-3.5 w-3.5" />
        New profile
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create new profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Identity */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-name">Person name <span className="text-rose-500">*</span></Label>
              <Input
                id="np-name"
                required
                value={form.personName}
                onChange={(e) => setField('personName', e.target.value)}
                placeholder="e.g. Hadiqa"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-label">Gmail label <span className="text-rose-500">*</span></Label>
              <Input
                id="np-label"
                required
                value={form.gmailLabel}
                onChange={(e) => setField('gmailLabel', e.target.value)}
                placeholder="pitchlane/hadiqa"
              />
            </div>
          </div>

          {/* Routing */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-inbox">Forwarding inbox <span className="text-rose-500">*</span></Label>
              <Input
                id="np-inbox"
                type="email"
                required
                value={form.forwardingInbox}
                onChange={(e) => setField('forwardingInbox', e.target.value)}
                placeholder="profile@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-notify">Notification email</Label>
              <Input
                id="np-notify"
                type="email"
                value={form.notificationEmail}
                onChange={(e) => setField('notificationEmail', e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Qualification */}
          <div className="space-y-1.5">
            <Label htmlFor="np-role">Role focus <span className="text-rose-500">*</span></Label>
            <Input
              id="np-role"
              required
              value={form.roleFocus}
              onChange={(e) => setField('roleFocus', e.target.value)}
              placeholder="e.g. Data Analytics & Power BI"
            />
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-widest">Lead qualification</p>
            <div className="space-y-1.5">
              <Label htmlFor="np-keywords">Target keywords</Label>
              <Input
                id="np-keywords"
                value={form.targetKeywords}
                onChange={(e) => setField('targetKeywords', e.target.value)}
                placeholder="Power BI, SQL, dashboard, analytics"
              />
              <p className="text-xs text-stone-400">Comma-separated. Boosts score when found in lead.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-skills">Required skills</Label>
              <Input
                id="np-skills"
                value={form.requiredSkills}
                onChange={(e) => setField('requiredSkills', e.target.value)}
                placeholder="Python, SQL, Excel"
              />
              <p className="text-xs text-stone-400">Comma-separated. Lead fails hard filter if none match.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-reject">Reject rules</Label>
              <Input
                id="np-reject"
                value={form.rejectRules}
                onChange={(e) => setField('rejectRules', e.target.value)}
                placeholder="entry level, no budget, hourly only"
              />
              <p className="text-xs text-stone-400">Comma-separated phrases. Lead is auto-rejected if matched.</p>
            </div>
          </div>

          {status && <p className="text-sm text-rose-600">{status}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Creating…' : 'Create profile'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProfileButton({ accountId, personName }: { accountId: string; personName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    try {
      await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg p-1.5 text-stone-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
            title="Delete profile"
          />
        }
      >
        <Trash2 className="size-3.5" />
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {personName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the profile and all associated leads, evaluations, and proposals. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={handleDelete}
            className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
          >
            {pending ? 'Deleting…' : 'Delete profile'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ProfileWorkbench({ profiles, selectedProfile }: WorkbenchProps) {
  const router = useRouter();

  return (
    <div>
      {/* header row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-500">{profiles.length} profile{profiles.length !== 1 ? 's' : ''}</p>
        <NewProfileDialog onSuccess={() => router.refresh()} />
      </div>

      {/* table */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50/80">
              <TableHead>Profile</TableHead>
              <TableHead>Role focus</TableHead>
              <TableHead>Gmail label</TableHead>
              <TableHead className="text-right">Threshold</TableHead>
              <TableHead>Tone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-stone-400">
                  No profiles found. Seed the database to get started.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((entry) => (
                <TableRow
                  key={entry.account.id}
                  className="group cursor-pointer hover:bg-amber-50/40"
                  onClick={() => router.push(`/profiles?profileId=${entry.account.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800">
                        {entry.account.personName[0]}
                      </div>
                      <p className="font-medium text-stone-900">{entry.account.personName}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-52">
                    <p className="truncate text-sm text-stone-700">{entry.profileConfig?.roleFocus ?? '—'}</p>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                      {entry.account.gmailLabel}
                    </code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {entry.profileConfig?.scoreThreshold ?? '—'}
                  </TableCell>
                  <TableCell>
                    {entry.profileConfig ? (
                      <Badge variant="outline" className={`text-xs ${toneColors[entry.profileConfig.proposalTone]}`}>
                        {toneLabels[entry.profileConfig.proposalTone]}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={entry.account.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}>
                      {entry.account.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-stone-400">
                    {entry.profileConfig ? new Date(entry.profileConfig.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DeleteProfileButton accountId={entry.account.id} personName={entry.account.personName} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* side panel */}
      <Sheet
        open={selectedProfile !== null}
        onOpenChange={(open) => { if (!open) router.push('/profiles'); }}
      >
        <SheetContent side="right" className="data-[side=right]:w-[70vw] data-[side=right]:max-w-[70vw] data-[side=right]:sm:max-w-[70vw] p-0 flex flex-col">
          {selectedProfile && (
            <ProfileSheetContent key={selectedProfile.account.id} entry={selectedProfile} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
