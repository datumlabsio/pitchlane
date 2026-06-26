'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu } from 'lucide-react';

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { navItems } from '@/components/layout/sidebar';
import { cn } from '@/lib/utils';

/** Top bar + slide-out drawer shown below `lg`, where the sidebar is hidden. */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } catch {
      // ignore
    }
    setOpen(false);
    router.push('/login');
  }

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/60 bg-white/55 px-4 py-3 backdrop-blur lg:hidden">
      <p className="text-sm font-semibold tracking-tight text-stone-900">SalesFlow</p>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Open menu"
              className="rounded-lg p-1.5 text-stone-700 transition hover:bg-stone-200/60"
            />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 max-w-[82vw] flex-col bg-[#1f1a17] p-5 text-stone-50">
          <SheetTitle className="text-xs uppercase tracking-[0.3em] text-amber-200/70">SalesFlow</SheetTitle>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                    active ? 'bg-white/12 font-medium text-white' : 'text-stone-400 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={signOut}
            className="mt-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-stone-400 transition hover:bg-white/8 hover:text-white"
          >
            <LogOut className="size-4" />
            <span>Sign out</span>
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
