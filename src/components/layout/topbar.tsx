import type { ReactNode } from 'react';

export function Topbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">Pitchlane</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{subtitle}</p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>
      )}
    </header>
  );
}
