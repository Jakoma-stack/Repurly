import Link from "next/link";
import { BellRing, CreditCard, History, LayoutDashboard, PencilLine, Send, Settings, Sparkles, PanelsTopLeft, Building2 } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import type { WorkspaceSession } from "@/lib/auth/workspace";

const nav = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/content", label: "Composer", icon: PencilLine },
  { href: "/app/calendar", label: "Calendar & queue", icon: Send },
  { href: "/app/channels", label: "Channel setup", icon: PanelsTopLeft },
  { href: "/app/activity", label: "Job detail", icon: History },
  { href: "/app/reliability", label: "Reliability", icon: BellRing },
  { href: "/app/notifications", label: "Notifications", icon: BellRing },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, session }: { children: React.ReactNode; session: WorkspaceSession }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-border bg-white p-5 shadow-card lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary"><Sparkles className="size-5" /></div>
            <div>
              <div className="font-semibold">Repurly</div>
              <div className="text-sm text-muted-foreground">{session.workspaceName}</div>
            </div>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
                  <Icon className="size-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </aside>
        <div className="flex-1">
          <header className="mb-6 flex items-center justify-between rounded-3xl border border-border bg-white px-5 py-4 shadow-card">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-100 p-2 text-slate-700"><Building2 className="size-4" /></div>
                <div>
                  <h1 className="text-lg font-semibold">{session.workspaceName}</h1>
                  <p className="text-sm text-muted-foreground">{session.role} • {session.workspaceSlug}</p>
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
