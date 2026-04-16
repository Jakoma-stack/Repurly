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
  ShieldCheck,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';

import type { WorkspaceSession } from '@/lib/auth/workspace';

type BillingAccessState = {
  hasPaidAccess: boolean;
  plan: 'core' | 'growth' | 'scale';
} | null;

const fullNav = [
  { href: '/app', label: 'Overview', icon: LayoutDashboard },
  { href: '/app/content', label: 'Studio', icon: PencilLine },
  { href: '/app/brands', label: 'Brands', icon: BriefcaseBusiness },
  { href: '/app/calendar', label: 'Calendar & queue', icon: Send },
  { href: '/app/engagement', label: 'Engagement', icon: MessageSquareQuote },
  { href: '/app/leads', label: 'Leads', icon: Users },
  { href: '/app/channels', label: 'Channels', icon: PanelsTopLeft },
  { href: '/app/activity', label: 'Delivery history', icon: History },
  { href: '/app/reliability', label: 'Reliability', icon: ShieldCheck },
  { href: '/app/notifications', label: 'Notifications', icon: BellRing },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

const unpaidNav = [{ href: '/app/billing', label: 'Billing', icon: CreditCard }];

export function AppShell({
  children,
  session,
  billingAccess,
}: {
  children: React.ReactNode;
  session: WorkspaceSession;
  billingAccess?: BillingAccessState;
}) {
  const paid = billingAccess?.hasPaidAccess ?? true;
  const nav = paid ? fullNav : unpaidNav;

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex max-w-[1480px] gap-6 px-4 py-6 lg:px-8">
        <aside className="premium-dark hidden w-80 shrink-0 p-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-2 text-white ring-1 ring-white/10">
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

          <div className="mb-6 rounded-[1.5rem] border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 to-cyan-400/10 p-4 text-sm text-white/78">
            <div className="eyebrow !text-white/50">Positioning</div>
            <div className="mt-2 text-base font-semibold text-white">Premium content operations without feature sacrifice</div>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Workflow control, creative parity, and operator confidence in one surface.
            </p>
          </div>

          {!paid ? (
            <div className="mb-6 rounded-[1.5rem] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Payment is required before this workspace can use the product. Core or Growth unlocks access.
            </div>
          ) : null}

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
          <header className="premium-surface mb-6 flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                <Building2 className="size-4" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">{session.workspaceName}</h1>
                <p className="text-sm text-muted-foreground">
                  {session.role} • {session.availableWorkspaces.length} workspace access
                  {billingAccess ? ` • ${billingAccess.hasPaidAccess ? billingAccess.plan : 'payment required'}` : ''}
                </p>
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
