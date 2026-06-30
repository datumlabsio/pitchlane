import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_28%),linear-gradient(180deg,#f9f4ec_0%,#f4efe6_100%)] p-4 md:p-6">
        <div className="mx-auto max-w-[1600px]">
          <MobileNav />
          <div className="flex min-h-[calc(100vh-2rem)] gap-4 lg:gap-6">
            <Sidebar />
            <main className="min-w-0 flex-1 overflow-hidden rounded-[2rem] border border-white/60 bg-white/55 p-4 shadow-[0_18px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5 md:p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
