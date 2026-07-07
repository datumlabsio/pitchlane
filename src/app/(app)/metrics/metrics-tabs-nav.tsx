'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const TABS = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'costing', label: 'Costing' },
  { id: 'keywords', label: 'Keywords' },
];

export function MetricsTabsNav() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const active = sp.get('tab') ?? 'pipeline';

  // Preserve the date/profile filters when switching tabs; drop ?tab for the default.
  const hrefFor = (id: string) => {
    const p = new URLSearchParams(sp.toString());
    if (id === 'pipeline') p.delete('tab');
    else p.set('tab', id);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="flex flex-wrap gap-1 border-b border-stone-200">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            scroll={false}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
