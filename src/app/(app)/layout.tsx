import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/layout/sidebar';
import { getLastGmailSyncAt } from '@/domain/integrations/repository';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const lastSyncAt = await getLastGmailSyncAt().catch(() => null);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_28%),linear-gradient(180deg,#f9f4ec_0%,#f4efe6_100%)] p-4 md:p-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:gap-6">
          <Sidebar lastSyncAt={lastSyncAt ? lastSyncAt.toISOString() : null} />
          <main className="flex-1 overflow-hidden rounded-[2rem] border border-white/60 bg-white/55 p-5 shadow-[0_18px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
