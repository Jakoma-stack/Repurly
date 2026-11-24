import {
  CreditCard,
  PencilLine,
  Settings,
  Sparkles,
  BriefcaseBusiness,
  Layers3,
  MessageSquareQuote,
  Users,
  UserPlus,
  ClipboardList,
  CalendarCheck,
  SlidersHorizontal,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import Image from 'next/image';

import type { WorkspaceSession } from '@/lib/auth/workspace';
import { formatPlanLabel } from '@/lib/billing/plans';

const BUILD_MARKER = '10/10 private beta package';

type BillingAccessState = {
  hasPaidAccess: boolean;
  plan: 'core' | 'growth' | 'scale';
} | null;

const fullNav = [
  { href: '/app/daily-agent', label: 'Daily Agent', icon: ClipboardList },
  { href: '/app/relationships', label: 'Relationships', icon: Users },
  { href: '/app/weekly-plan', label: 'Weekly Plan', icon: CalendarCheck },
  { href: '/app/opportunity-settings', label: 'Opportunity Settings', icon: SlidersHorizontal },
  { href: '/app/content', label: 'Content', icon: PencilLine },
  { href: '/app/marketing-director', label: 'Marketing Director', icon: Sparkles },
  { href: '/app/portfolio', label: 'App Portfolio', icon: Layers3 },
  { href: '/app/engagement', label: 'Engagement', icon: MessageSquareQuote },
  { href: '/app/community', label: 'Community intelligence', icon: BarChart3 },
  { href: '/app/outreach-copilot', label: 'Outreach', icon: UserPlus },
  { href: '/app/brands', label: 'Brand settings', icon: BriefcaseBusiness },
  { href: '/app/pilot-dashboard', label: 'Pilot Dashboard', icon: BarChart3 },
  { href: '/app/proof-score', label: 'Proof Score', icon: ShieldCheck },
  { href: '/app/settings', label: 'Settings', icon: Settings },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
];

const unpaidNav = [{ href: '/app/billing', label: 'Billing', icon: CreditCard }];

export function AppShell({
  children,
  session,
  billingAccess,
  communityEligible = false,
}: {
  children: React.ReactNode;
  session: WorkspaceSession;
  billingAccess?: BillingAccessState;
  communityEligible?: boolean;
}) {
  const paid = billingAccess?.hasPaidAccess ?? true;
  const nav = paid ? fullNav.filter(item => item.href !== '/app/community' || communityEligible) : unpaidNav;

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto flex max-w-[1480px] gap-6 px-4 py-6 lg:px-8">
        <aside className="premium-dark !bg-[#102D32] hidden w-80 shrink-0 p-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-2 text-white ring-1 ring-white/10">
              <Image src="/brand/repurly/mark.svg" width={40} height={40} alt="" unoptimized/>
            </div>
            <div>
              <div className="font-semibold tracking-tight">Janeomi</div>
              <div className="text-xs text-[#A7E7CC]">Intelligence with ambition.</div>
              <div className="text-sm text-white/60">AI Marketing &amp; Growth Intelligence</div>
            </div>
          </div>

          <div className="mb-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-white/45">Workspace</div>
            <div className="mt-2 text-lg font-semibold">{session.workspaceName}</div>
            <div className="mt-1 text-sm text-white/55">{session.role} • {session.workspaceSlug}</div>
          </div>

          <div className="mb-6 rounded-[1.5rem] border border-teal-300/20 bg-gradient-to-br from-teal-500/15 to-emerald-400/10 p-4 text-sm text-white/78">
            <div className="eyebrow !text-white/50">Positioning</div>
            <div className="mt-2 text-base font-semibold text-white">Your AI marketing director</div>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Plan campaigns across your brands, review LinkedIn activity, build relationships and approve content and follow-up actions.
            </p>
          </div>

          {!paid ? (
            <div className="mb-6 rounded-[1.5rem] border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Beta access is not enabled for this workspace yet. Ask the Janeomi team to switch on private beta access or connect billing.
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
                <Image src="/brand/repurly/mark.svg" width={28} height={28} alt="Janeomi" unoptimized/>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">{session.workspaceName}</h1>
                <p className="text-sm text-muted-foreground">
                  {session.role} • {session.availableWorkspaces.length} workspace access
                  {billingAccess ? ` • ${billingAccess.hasPaidAccess ? formatPlanLabel(billingAccess.plan) : 'beta access not enabled'}` : ''}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">{BUILD_MARKER}</span>
                  <a href="/app/daily-agent" className="font-medium text-primary">Daily Agent</a>
                  <a href="/app/relationships" className="font-medium text-primary">Relationships</a>
                  <a href="/app/weekly-plan" className="font-medium text-primary">Weekly Plan</a>
                  <a href="/app/portfolio" className="font-medium text-primary">Portfolio</a>
                  <a href="/app/opportunity-settings" className="font-medium text-primary">Opportunity Settings</a>
                  <a href="/app/proof-score" className="font-medium text-primary">Proof Score</a>
                </div>
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
