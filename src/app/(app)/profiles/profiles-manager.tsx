'use client';

import { ProposalTone } from '@/domain/enums';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AccountSettingsView } from '@/domain/accounts/types';
import type { EditableProfileView, ProfileConfigView, ScoringWeights } from '@/domain/profiles/types';

const proposalToneOptions: Array<{ value: ProposalTone; label: string }> = [
  { value: ProposalTone.CONSULTATIVE, label: 'Consultative' },
  { value: ProposalTone.DIRECT, label: 'Direct' },
  { value: ProposalTone.EXPERT, label: 'Expert' },
  { value: ProposalTone.FRIENDLY, label: 'Friendly' },
];

function listToMultiline(values: string[]) {
  return values.join('\n');
}

function multilineToList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

type WeightsForm = {
  skillMatch: string;
  roleFit: string;
  keywordMatch: string;
  budgetFit: string;
  confidence: string;
};

type AccountFormState = {
  gmailLabel: string;
  forwardingInbox: string;
  notificationEmail: string;
  isActive: boolean;
};

type ProfileFormState = {
  isActive: boolean;
  roleFocus: string;
  jdSummary: string;
  targetRoles: string;
  targetKeywords: string;
  requiredSkills: string;
  niceToHaveSkills: string;
  rejectRules: string;
  budgetPreference: string;
  scoreThreshold: string;
  proposalTone: ProposalTone;
  proposalRules: string;
  reusableSnippets: string;
  scoringWeights: WeightsForm;
};

function createAccountForm(account: AccountSettingsView): AccountFormState {
  return {
    gmailLabel: account.gmailLabel,
    forwardingInbox: account.forwardingInbox,
    notificationEmail: account.notificationEmail ?? '',
    isActive: account.isActive,
  };
}

function createProfileForm(cfg: ProfileConfigView): ProfileFormState {
  const w = (cfg.scoringWeights ?? {}) as Partial<ScoringWeights>;
  return {
    isActive: cfg.isActive,
    roleFocus: cfg.roleFocus,
    jdSummary: cfg.jdSummary,
    targetRoles: listToMultiline(cfg.targetRoles),
    targetKeywords: listToMultiline(cfg.targetKeywords),
    requiredSkills: listToMultiline(cfg.requiredSkills),
    niceToHaveSkills: listToMultiline(cfg.niceToHaveSkills),
    rejectRules: listToMultiline(cfg.rejectRules),
    budgetPreference: cfg.budgetPreference ?? '',
    scoreThreshold: String(cfg.scoreThreshold),
    proposalTone: cfg.proposalTone,
    proposalRules: listToMultiline(cfg.proposalRules),
    reusableSnippets: listToMultiline(cfg.reusableSnippets),
    scoringWeights: {
      skillMatch: String(w.skillMatch ?? 0.35),
      roleFit: String(w.roleFit ?? 0.25),
      keywordMatch: String(w.keywordMatch ?? 0.2),
      budgetFit: String(w.budgetFit ?? 0.1),
      confidence: String(w.confidence ?? 0.1),
    },
  };
}

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>
    </div>
  );
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

function StatusRow({ status, pending }: { status: string; pending: boolean }) {
  if (!status && !pending) return null;
  return (
    <p className={`text-xs ${status.includes('saved') ? 'text-emerald-700' : 'text-rose-600'}`}>
      {pending ? '...' : status}
    </p>
  );
}

function ProfileEditorCard({ entry }: { entry: EditableProfileView }) {
  const [accountForm, setAccountForm] = useState(() => createAccountForm(entry.account));
  const [currentProfileConfig, setCurrentProfileConfig] = useState(entry.profileConfig);
  const [profileForm, setProfileForm] = useState(() =>
    entry.profileConfig ? createProfileForm(entry.profileConfig) : null,
  );
  const [accountPending, setAccountPending] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [accountStatus, setAccountStatus] = useState('');
  const [profileStatus, setProfileStatus] = useState('');

  const lastUpdated = useMemo(() => {
    if (!currentProfileConfig) return 'No config linked yet';
    return new Date(currentProfileConfig.updatedAt).toLocaleString();
  }, [currentProfileConfig]);

  const weightsSum = useMemo(() => {
    if (!profileForm) return null;
    const sum = Object.values(profileForm.scoringWeights).reduce(
      (acc, v) => acc + (parseFloat(v) || 0),
      0,
    );
    return Math.round(sum * 100) / 100;
  }, [profileForm]);

  function setWeight(key: keyof WeightsForm, value: string) {
    setProfileForm((c) => c ? { ...c, scoringWeights: { ...c.scoringWeights, [key]: value } } : c);
  }

  async function saveAccount() {
    setAccountPending(true);
    setAccountStatus('');
    try {
      const res = await fetch(`/api/accounts/${entry.account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setAccountStatus(data.error || 'Save failed'); return; }
      setAccountStatus('Account settings saved.');
      setAccountForm(createAccountForm(data.account as AccountSettingsView));
    } catch (e) {
      setAccountStatus(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setAccountPending(false);
    }
  }

  async function saveProfile() {
    if (!currentProfileConfig || !profileForm) return;
    setProfilePending(true);
    setProfileStatus('');
    const threshold = parseInt(profileForm.scoreThreshold, 10);
    try {
      const res = await fetch(`/api/profile-configs/${currentProfileConfig.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: profileForm.isActive,
          roleFocus: profileForm.roleFocus,
          jdSummary: profileForm.jdSummary,
          targetRoles: multilineToList(profileForm.targetRoles),
          targetKeywords: multilineToList(profileForm.targetKeywords),
          requiredSkills: multilineToList(profileForm.requiredSkills),
          niceToHaveSkills: multilineToList(profileForm.niceToHaveSkills),
          rejectRules: multilineToList(profileForm.rejectRules),
          budgetPreference: profileForm.budgetPreference,
          scoreThreshold: isNaN(threshold) ? 70 : threshold,
          proposalTone: profileForm.proposalTone,
          proposalRules: multilineToList(profileForm.proposalRules),
          reusableSnippets: multilineToList(profileForm.reusableSnippets),
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
      setProfileStatus('Profile config saved.');
      setCurrentProfileConfig(data.profileConfig as ProfileConfigView);
      setProfileForm(createProfileForm(data.profileConfig as ProfileConfigView));
    } catch (e) {
      setProfileStatus(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setProfilePending(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      {/* Card header */}
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-stone-950">{entry.account.personName}</p>
            <p className="text-sm text-stone-500">{entry.account.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className={accountForm.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}>
                {accountForm.isActive ? 'Active' : 'Paused'}
              </Badge>
              {currentProfileConfig ? (
                <Badge variant="outline" className={profileForm?.isActive ? 'border-amber-200 bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-500'}>
                  Config v{currentProfileConfig.version} {profileForm?.isActive ? 'on' : 'off'}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">No config</Badge>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-500">
            <p className="font-medium text-stone-700">Last updated</p>
            <p className="mt-0.5">{lastUpdated}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Account routing ── */}
        <div className="rounded-xl border border-stone-100 bg-stone-50/70 p-4 space-y-4">
          <SectionLabel
            title="Account routing"
            subtitle="Gmail label, inbox routing, notifications, and automation participation."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Gmail label" id={`gl-${entry.account.id}`}>
              <Input
                id={`gl-${entry.account.id}`}
                value={accountForm.gmailLabel}
                onChange={(e) => setAccountForm((c) => ({ ...c, gmailLabel: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label="Forwarding inbox" id={`fi-${entry.account.id}`}>
              <Input
                id={`fi-${entry.account.id}`}
                type="email"
                value={accountForm.forwardingInbox}
                onChange={(e) => setAccountForm((c) => ({ ...c, forwardingInbox: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label="Notification email" hint="Leave blank to disable." id={`ne-${entry.account.id}`}>
              <Input
                id={`ne-${entry.account.id}`}
                type="email"
                value={accountForm.notificationEmail}
                onChange={(e) => setAccountForm((c) => ({ ...c, notificationEmail: e.target.value }))}
              />
            </FieldRow>
            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3">
              <div>
                <Label htmlFor={`ia-${entry.account.id}`} className="text-stone-900">Account active</Label>
                <p className="mt-0.5 text-xs text-stone-500">Disable to pause automation without deleting the account.</p>
              </div>
              <Switch
                id={`ia-${entry.account.id}`}
                checked={accountForm.isActive}
                onCheckedChange={(checked) => setAccountForm((c) => ({ ...c, isActive: checked }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button size="sm" disabled={accountPending} onClick={saveAccount}>
              {accountPending ? 'Saving…' : 'Save account'}
            </Button>
            <StatusRow status={accountStatus} pending={accountPending} />
          </div>
        </div>

        {/* ── Profile config ── */}
        {currentProfileConfig && profileForm ? (
          <div className="space-y-5">
            <Separator />
            <SectionLabel
              title="Qualification rules"
              subtitle="Controls how each incoming lead is scored and whether it passes the hard filter."
            />

            {/* Core */}
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Role focus" id={`rf-${entry.account.id}`}>
                <Input
                  id={`rf-${entry.account.id}`}
                  value={profileForm.roleFocus}
                  onChange={(e) => setProfileForm((c) => c ? { ...c, roleFocus: e.target.value } : c)}
                />
              </FieldRow>
              <FieldRow label="Score threshold" hint="Minimum score (0–100) to qualify automatically." id={`st-${entry.account.id}`}>
                <Input
                  id={`st-${entry.account.id}`}
                  type="number"
                  min={0}
                  max={100}
                  value={profileForm.scoreThreshold}
                  onChange={(e) => setProfileForm((c) => c ? { ...c, scoreThreshold: e.target.value } : c)}
                />
              </FieldRow>
            </div>

            <FieldRow label="JD summary" hint="Tight positioning statement. Used by proposal generation for context." id={`jd-${entry.account.id}`}>
              <Textarea
                id={`jd-${entry.account.id}`}
                rows={4}
                value={profileForm.jdSummary}
                onChange={(e) => setProfileForm((c) => c ? { ...c, jdSummary: e.target.value } : c)}
              />
            </FieldRow>

            <FieldRow label="Budget preference" hint="Describes the budget context this profile targets (used in scoring)." id={`bp-${entry.account.id}`}>
              <Input
                id={`bp-${entry.account.id}`}
                value={profileForm.budgetPreference}
                onChange={(e) => setProfileForm((c) => c ? { ...c, budgetPreference: e.target.value } : c)}
              />
            </FieldRow>

            {/* Targeting */}
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldRow label="Target roles" hint="One per line or comma separated.">
                <Textarea
                  rows={5}
                  value={profileForm.targetRoles}
                  onChange={(e) => setProfileForm((c) => c ? { ...c, targetRoles: e.target.value } : c)}
                />
              </FieldRow>
              <FieldRow label="Target keywords" hint="One per line or comma separated.">
                <Textarea
                  rows={5}
                  value={profileForm.targetKeywords}
                  onChange={(e) => setProfileForm((c) => c ? { ...c, targetKeywords: e.target.value } : c)}
                />
              </FieldRow>
              <FieldRow label="Required skills" hint="Must match at least one to pass the hard filter.">
                <Textarea
                  rows={5}
                  value={profileForm.requiredSkills}
                  onChange={(e) => setProfileForm((c) => c ? { ...c, requiredSkills: e.target.value } : c)}
                />
              </FieldRow>
              <FieldRow label="Nice-to-have skills" hint="Each match adds bonus points to the final score.">
                <Textarea
                  rows={5}
                  value={profileForm.niceToHaveSkills}
                  onChange={(e) => setProfileForm((c) => c ? { ...c, niceToHaveSkills: e.target.value } : c)}
                />
              </FieldRow>
            </div>

            <FieldRow label="Reject rules" hint="Hard disqualifiers — any match rejects the lead automatically.">
              <Textarea
                rows={4}
                value={profileForm.rejectRules}
                onChange={(e) => setProfileForm((c) => c ? { ...c, rejectRules: e.target.value } : c)}
              />
            </FieldRow>

            {/* Scoring weights */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel
                  title="Scoring weights"
                  subtitle="Each weight controls how much that signal contributes to the final score."
                />
                <span className={`text-xs font-medium ${weightsSum === 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Sum: {weightsSum} {weightsSum !== 1 ? '— should be 1.0' : '✓'}
                </span>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
                {([
                  ['skillMatch', 'Skill match'],
                  ['roleFit', 'Role fit'],
                  ['keywordMatch', 'Keywords'],
                  ['budgetFit', 'Budget fit'],
                  ['confidence', 'Confidence'],
                ] as [keyof WeightsForm, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-stone-600">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={profileForm.scoringWeights[key]}
                      onChange={(e) => setWeight(key, e.target.value)}
                      className="text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Proposal generation */}
            <Separator />
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <SectionLabel
                  title="Proposal generation"
                  subtitle="Tone, rules, and reusable snippets passed into each proposal draft."
                />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`ca-${entry.account.id}`}
                      checked={profileForm.isActive}
                      onCheckedChange={(checked) => setProfileForm((c) => c ? { ...c, isActive: checked } : c)}
                    />
                    <Label htmlFor={`ca-${entry.account.id}`} className="text-sm text-stone-700">Config active</Label>
                  </div>
                  <FieldRow label="Tone" id={`tone-${entry.account.id}`}>
                    <Select
                      value={profileForm.proposalTone}
                      onValueChange={(v) => setProfileForm((c) => c ? { ...c, proposalTone: v as ProposalTone } : c)}
                    >
                      <SelectTrigger id={`tone-${entry.account.id}`} className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {proposalToneOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldRow label="Proposal rules" hint="Instructions the writer always follows.">
                  <Textarea
                    rows={5}
                    value={profileForm.proposalRules}
                    onChange={(e) => setProfileForm((c) => c ? { ...c, proposalRules: e.target.value } : c)}
                  />
                </FieldRow>
                <FieldRow label="Reusable snippets" hint="Atomic phrases injected into generated drafts.">
                  <Textarea
                    rows={5}
                    value={profileForm.reusableSnippets}
                    onChange={(e) => setProfileForm((c) => c ? { ...c, reusableSnippets: e.target.value } : c)}
                  />
                </FieldRow>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button size="sm" disabled={profilePending} onClick={saveProfile}>
                {profilePending ? 'Saving…' : 'Save profile config'}
              </Button>
              <StatusRow status={profileStatus} pending={profilePending} />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/70 p-5 text-sm text-stone-500">
            No profile config linked to this account yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfilesManager({ entries }: { entries: EditableProfileView[] }) {
  if (entries.length === 0) {
    return <Card><CardContent className="py-8 text-sm text-stone-500">No profile configurations found.</CardContent></Card>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {entries.map((entry) => (
        <ProfileEditorCard key={entry.account.id} entry={entry} />
      ))}
    </div>
  );
}
