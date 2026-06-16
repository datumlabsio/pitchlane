export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-stone-500">Pitchlane</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{subtitle}</p>
      </div>
      <div className="inline-flex items-center gap-3 rounded-full border border-stone-900/10 bg-white/70 px-4 py-2 text-sm text-stone-700 shadow-sm backdrop-blur">
        <span className="size-2 rounded-full bg-emerald-500" />
        System ready for Gmail, OpenAI, Supabase, and Trigger.dev wiring
      </div>
    </header>
  );
}
