import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getWorkspaceSetupState } from '@/lib/onboarding/setup';
import { getDashboardSnapshot } from '@/server/queries/dashboard';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ kind, children }: { kind: 'success' | 'warning'; children: React.ReactNode }) {
  const styles = kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900';
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function statusClasses(status: 'complete' | 'current' | 'blocked') {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'current') return 'border-slate-900 bg-slate-900 text-white';
  return 'border-border bg-white text-slate-500';
}

export default async function AppHomePage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const [setup, dashboard, params] = await Promise.all([
    getWorkspaceSetupState(session.workspaceId),
    getDashboardSnapshot(session.workspaceId),
    searchParams ?? Promise.resolve({}),
  ]);
  const linkedInState = firstParam(params.linkedin);
  const setupState = firstParam(params.setup);
  const inviteAccepted = firstParam(params.ok);

  return (
    <div className="space-y-6">
      {linkedInState === 'connected' && <Banner kind="success">LinkedIn connected. Confirm the default target, then move into drafting and approval.</Banner>}
      {setupState === 'required' && <Banner kind="warning">Finish LinkedIn setup before opening composer. That keeps the first workflow grounded in a real target.</Banner>}
      {inviteAccepted === 'invite-accepted' && <Banner kind="success">Invite accepted. The workspace is ready for team workflow.</Banner>}

      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold">{setup.isReadyForComposer ? 'Workspace ready for content operations' : 'Finish setup before opening composer'}</h2>
          <p className="text-sm text-muted-foreground">Use this page as the operating start point: complete setup, open the planner, review the queue, and keep an eye on approvals and leads.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700"><div className="font-medium text-slate-950">LinkedIn connection</div><div className="mt-1">{setup.linkedInConnected ? 'Connected' : 'Not connected yet'}</div></div>
            <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700"><div className="font-medium text-slate-950">LinkedIn targets</div><div className="mt-1">{setup.linkedInTargetCount}</div></div>
            <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700"><div className="font-medium text-slate-950">Brands available</div><div className="mt-1">{setup.brandCount}</div></div>
            <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700"><div className="font-medium text-slate-950">Hot leads</div><div className="mt-1">{dashboard.workflow.hotLeads}</div></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={setup.primaryCtaHref}><Button>{setup.primaryCtaLabel}</Button></Link>
            <Link href="/app/reports"><Button variant="outline">Open reporting</Button></Link>
            {setup.isReadyForComposer && <Link href="/app/calendar"><Button variant="outline">Open calendar and queue</Button></Link>}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        {setup.steps.map((step, index) => (
          <Card key={step.key} className={statusClasses(step.status)}>
            <CardHeader>
              <div className="text-sm font-medium opacity-80">Step {index + 1}</div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className={step.status === 'current' ? 'text-slate-200' : step.status === 'complete' ? 'text-emerald-900/80' : 'text-slate-500'}>{step.description}</p>
              <Link href={step.href} className={step.status === 'current' ? 'font-medium text-white underline-offset-4 hover:underline' : 'font-medium text-primary'}>Open step</Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{metric.label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">What happens after setup</h3>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
          <div className="rounded-2xl border border-border p-4">1. Draft in the planner and composer with AI support when needed.</div>
          <div className="rounded-2xl border border-border p-4">2. Route the post through approval, then schedule it against the right target.</div>
          <div className="rounded-2xl border border-border p-4">3. Review queue and job detail so failures can be recovered before trust breaks.</div>
          <div className="rounded-2xl border border-border p-4">4. Use engagement and leads to move from posting into actual workflow outcomes.</div>
        </CardContent>
      </Card>
    </div>
  );
}
