'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, BriefcaseBusiness, Inbox, LogOut, Settings2, Users2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export const navItems = [
  { href: '/', label: 'Overview', icon: BriefcaseBusiness },
  { href: '/leads', label: 'Leads', icon: Inbox },
  { href: '/profiles', label: 'Profiles', icon: Users2 },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  if (name) return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  if (email) return email[0].toUpperCase();
  return '?';
}

function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function Sidebar({ lastSyncAt }: { lastSyncAt: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; name?: string; avatar?: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted || !session?.user) return;
        const u = session.user;
        setUser({
          email: u.email ?? undefined,
          name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? undefined,
          avatar: u.user_metadata?.avatar_url ?? undefined,
        });
      });
    } catch {
      // Supabase not configured — no user info available
    }
    return () => { mounted = false; };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push('/login');
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto rounded-[2rem] border border-amber-950/10 bg-[#1f1a17] p-5 text-stone-50 shadow-2xl lg:flex sticky top-4 md:top-6 h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)]">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">SalesFlow</p>
        <h1 className="mt-3 text-2xl font-semibold">Lead intelligence for multi-profile Upwork ops.</h1>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                active
                  ? 'bg-white/12 font-medium text-white'
                  : 'text-stone-400 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className={`size-4 transition ${active ? '' : 'group-hover:scale-110'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 space-y-3">
        {/* Gmail sync card */}
        <div className="rounded-3xl bg-linear-to-br from-amber-300 to-orange-400 p-5 text-stone-950">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-600/60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-700" />
            </span>
            <p className="text-sm font-medium">Gmail sync active</p>
          </div>
          <p className="mt-2 text-sm text-stone-900/80">
            {lastSyncAt ? (
              <>Last synced <span className="font-semibold">{formatSyncTime(lastSyncAt)}</span></>
            ) : (
              'No sync has run yet. Run one from Settings.'
            )}
          </p>
        </div>

        {/* User profile + logout */}
        {user && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
            {/* Avatar */}
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name ?? user.email ?? ''}
                className="size-8 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-stone-950">
                {initials(user.name, user.email)}
              </div>
            )}

            {/* Name / email */}
            <div className="min-w-0 flex-1">
              {user.name && (
                <p className="truncate text-xs font-medium text-white">{user.name}</p>
              )}
              <p className="truncate text-xs text-stone-400">{user.email}</p>
            </div>

            {/* Logout */}
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              title="Sign out"
              className="shrink-0 rounded-xl p-1.5 text-stone-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
