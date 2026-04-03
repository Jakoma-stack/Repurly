import {
  BellRing,
  CreditCard,
  History,
  LayoutDashboard,
  PencilLine,
  Send,
  Settings,
  Sparkles,
  PanelsTopLeft,
  Building2,
  BriefcaseBusiness,
  MessageSquareQuote,
  Users,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import type { WorkspaceSession } from '@/lib/auth/workspace';

const nav = [
  { href: '/app', label: 'Overview', icon: LayoutDashboard },
  { href: '/app/content', label: 'Composer', icon: PencilLine },
  { href: '/app/brands', label: 'Brands', icon: BriefcaseBusiness },
  { href: '/app/calendar', label: 'Calendar & queue', icon: Send },
  { href: '/app/engagement', label: 'Engagement', icon: MessageSquareQuote },
  { href: '/app/leads', label: 'Leads', icon: Users },
  { href: '/app/channels', label: 'Channel setup', icon: PanelsTopLeft },
  { href: '/app/activity', label: 'Job detail', icon: History },
  { href: '/app/reliability', label: 'Reliability', icon: BellRing },
  { href: '/app/notifications', label: 'Notifications', icon: BellRing },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children, session }: { children: React.ReactNode; session: WorkspaceSession }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef2ff,transparent_28%),linear-gradient(to_bottom,#f8fafc,#f5f7fb)] text-slate-900">
      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-80 shrink-0 rounded-[2rem] border border-white/10 bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-2 text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tight">Repurly</div>
              <div className="text-sm text-white/60">Premium content operations</div>
            </div>
          </div>

          <div className="mb-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-white/45">Workspace</div>
            <div className="mt-2 text-lg font-semibold">{session.workspaceName}</div>
            <div className="mt-1 text-sm text-white/55">{session.role} • {session.workspaceSlug}</div>
          </div>

          <nav className="space-y-1.5">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/8 hover:text-white"
                >
                  <Icon className="size-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="mb-6 flex items-center justify-between rounded-[2rem] border border-slate-200/80 bg-white/90 px-5 py-4 shadow-card backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                <Building2 className="size-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">{session.workspaceName}</h1>
                <p className="text-sm text-muted-foreground">{session.role} • {session.availableWorkspaces.length} workspace access</p>
              </div>
            </div>
            <UserButton afterSignOutUrl="/" />
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
