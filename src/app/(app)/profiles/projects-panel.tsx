'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectView } from '@/domain/projects/types';

type ProfileOption = { id: string; personName: string };

type ProjectForm = {
  title: string;
  description: string;
  techStack: string;
  url: string;
  outcome: string;
  industry: string;
};

const EMPTY_FORM: ProjectForm = { title: '', description: '', techStack: '', url: '', outcome: '', industry: '' };

function toForm(p: ProjectView): ProjectForm {
  return {
    title: p.title,
    description: p.description,
    techStack: p.techStack.join(', '),
    url: p.url ?? '',
    outcome: p.outcome ?? '',
    industry: p.industry ?? '',
  };
}

function splitStack(value: string) {
  return value.split(/,|\n/).map((s) => s.trim()).filter(Boolean);
}

export function ProjectsPanel({
  accountId,
  projects: initialProjects,
  otherProfiles,
}: {
  accountId: string;
  projects: ProjectView[];
  otherProfiles: ProfileOption[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectView | null>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setStatus('');
    setDialogOpen(true);
  }
  function openEdit(project: ProjectView) {
    setEditing(project);
    setForm(toForm(project));
    setStatus('');
    setDialogOpen(true);
  }
  function setField(key: keyof ProjectForm, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  async function request(url: string, init: RequestInit): Promise<{ ok: boolean; project?: ProjectView; error?: string }> {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    return res.json();
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus('');
    const body = {
      title: form.title,
      description: form.description,
      techStack: splitStack(form.techStack),
      url: form.url.trim(),
      outcome: form.outcome.trim(),
      industry: form.industry.trim(),
    };
    try {
      const data = editing
        ? await request(`/api/projects/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await request('/api/projects', { method: 'POST', body: JSON.stringify({ accountId, ...body }) });
      if (!data.ok || !data.project) {
        setStatus(data.error || 'Save failed.');
        return;
      }
      setProjects((list) =>
        editing ? list.map((p) => (p.id === data.project!.id ? data.project! : p)) : [...list, data.project!],
      );
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPending(false);
    }
  }

  async function toggleActive(project: ProjectView, isActive: boolean) {
    const data = await request(`/api/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
    if (data.ok && data.project) {
      setProjects((list) => list.map((p) => (p.id === project.id ? data.project! : p)));
      router.refresh();
    }
  }

  async function removeProject(project: ProjectView) {
    const data = await request(`/api/projects/${project.id}`, { method: 'DELETE' });
    if (data.ok) {
      setProjects((list) => list.filter((p) => p.id !== project.id));
      router.refresh();
    }
  }

  async function copyTo(project: ProjectView, targetAccountId: string) {
    const data = await request(`/api/projects/${project.id}`, {
      method: 'POST',
      body: JSON.stringify({ copyToAccountId: targetAccountId }),
    });
    if (data.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-900">Portfolio projects</p>
          <p className="mt-0.5 text-xs text-stone-500">
            Real delivered work. The most relevant ones (by tech overlap) are cited — with links — in generated proposals.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-6 text-center">
          <p className="text-sm text-stone-600">No projects yet.</p>
          <p className="mt-1 text-xs text-stone-500">
            Add 3–5 strong ones — proposals citing real work (with links) get far more replies.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`rounded-xl border p-4 ${project.isActive ? 'border-stone-200 bg-white' : 'border-stone-200 bg-stone-50 opacity-70'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-stone-900">{project.title}</p>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        Link
                      </a>
                    )}
                    {project.industry && (
                      <Badge variant="outline" className="bg-stone-50 text-stone-600 font-normal">{project.industry}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-stone-600 line-clamp-3">{project.description}</p>
                  {project.outcome && (
                    <p className="mt-1 text-xs text-emerald-700">↗ {project.outcome}</p>
                  )}
                  {project.techStack.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {project.techStack.map((tech) => (
                        <Badge key={tech} variant="outline" className="bg-amber-50/60 border-amber-200 text-amber-800 font-normal">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Switch
                    checked={project.isActive}
                    onCheckedChange={(v) => toggleActive(project, v)}
                    title={project.isActive ? 'Active — can be cited in proposals' : 'Inactive — never cited'}
                  />
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(project)} title="Edit">
                    <Pencil className="size-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="h-7 px-2 text-stone-400 hover:text-rose-600" title="Delete" />}>
                      <Trash2 className="size-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{project.title}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Removes it permanently from this profile. To just stop citing it, toggle it inactive instead.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeProject(project)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {otherProfiles.length > 0 && (
                <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-2.5">
                  <Copy className="size-3 text-stone-400" />
                  <Select value={null} onValueChange={(v: string | null) => v && copyTo(project, v)}>
                    <SelectTrigger size="sm" className="h-6 gap-1 border-stone-200 bg-stone-50 px-1.5 py-0 text-[11px] font-normal text-stone-600">
                      <SelectValue>{() => 'Copy to profile…'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {otherProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.personName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-stone-400">then tailor the copy’s wording to that persona</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit project' : 'Add project'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="pj-title">Title <span className="text-rose-500">*</span></Label>
              <Input id="pj-title" required value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Multi-profile ATS with AI lead scoring" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pj-desc">Description <span className="text-rose-500">*</span></Label>
              <Textarea id="pj-desc" required rows={4} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="What you built, for whom, and what it does — 2–4 sentences the proposal can quote from." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pj-stack">Tech stack</Label>
                <Input id="pj-stack" value={form.techStack} onChange={(e) => setField('techStack', e.target.value)} placeholder="Next.js, PostgreSQL, Claude API" />
                <p className="text-xs text-stone-500">Comma-separated. Drives which jobs this project is cited for.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pj-industry">Industry</Label>
                <Input id="pj-industry" value={form.industry} onChange={(e) => setField('industry', e.target.value)} placeholder="e.g. real estate" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pj-url">Link</Label>
                <Input id="pj-url" type="url" value={form.url} onChange={(e) => setField('url', e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pj-outcome">Outcome</Label>
                <Input id="pj-outcome" value={form.outcome} onChange={(e) => setField('outcome', e.target.value)} placeholder="e.g. cut reporting time 70%" />
              </div>
            </div>
            {status && <p className="text-xs text-rose-600">{status}</p>}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? 'Saving…' : editing ? 'Save changes' : 'Add project'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
