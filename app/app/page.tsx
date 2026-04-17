import Link from 'next/link';
import { ArrowRight, CheckCircle2, Layers3, ShieldCheck, Sparkles, Workflow } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getWorkspaceSetupState } from '@/lib/onboarding/setup';
import { getPublishingQueue, getWorkflowMetrics } from '@/server/queries/workflow';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Banner({ kind, children }: { kind: 'success' | 'warning'; children: React.ReactNode }) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function statusClasses(status: 'complete' | 'current' | 'blocked') {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'current') return 'border-slate-900 bg-slate-900 text-white';
  return 'border-border bg-white text-slate-500';
}

function MetricCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
        <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

export default async function AppHomePage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const setup = await getWorkspaceSetupState(session.workspaceId);
  const metrics = await getWorkflowMetrics(session.workspaceId);
  const queue = await getPublishingQueue(session.workspaceId);
  const nextQueued = queue.slice(0, 4);
  const params = (await searchParams) ?? {};
  const linkedInState = firstParam(params.linkedin);
  const setupState = firstParam(params.setup);

  return (
    <div className="space-y-6">
      {linkedInState === 'connected' && (
        <Banner kind="success">LinkedIn connected. Confirm the default target, then move into drafting and approval.</Banner>
      )}
      {setupState === 'required' && (
        <Banner kind="warning">Finish LinkedIn setup before opening composer. That keeps the first workflow grounded in a real target.</Banner>
      )}

      <section className="premium-dark overflow-hidden p-7">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
          <div>
            <div className="eyebrow !text-white/50">Repurly operating system</div>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Best-in-class workflow control, with no sacrifice on creative, publishing, or content quality.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 md:text-base">
              Run premium content operations across brands, approvals, queue health, and delivery reliability while still giving teams a polished creative surface.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={setup.primaryCtaHref}><Button size="lg">{setup.primaryCtaLabel}</Button></Link>
              <Link href="/app/calendar"><Button variant="outline" size="lg" className="border-white/15 bg-white/5 text-white hover:bg-white/10">Review queue</Button></Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/68">
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Premium content operations</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Workflow moat</div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Creative parity</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <Workflow className="size-5 text-cyan-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{metrics.approvalsPending + metrics.scheduled}</div>
              <div className="mt-1 text-sm text-white/72">Items currently moving through approval and queue</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <Layers3 className="size-5 text-indigo-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{metrics.brandCount}</div>
              <div className="mt-1 text-sm text-white/72">Brands or clients managed in one workspace</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <Sparkles className="size-5 text-violet-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{metrics.drafts}</div>
              <div className="mt-1 text-sm text-white/72">Creative work in progress across the studio</div>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
              <ShieldCheck className="size-5 text-emerald-300" />
              <div className="mt-4 text-2xl font-semibold text-white">{metrics.failed}</div>
              <div className="mt-1 text-sm text-white/72">Delivery exceptions currently requiring operator attention</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Drafts" value={metrics.drafts} hint="Creative work waiting to be shaped" />
        <MetricCard label="Approvals pending" value={metrics.approvalsPending} hint="Posts blocked on reviewer action" />
        <MetricCard label="Scheduled" value={metrics.scheduled} hint="Queue committed to go live" />
        <MetricCard label="Published" value={metrics.published} hint="Delivered successfully" />
        <MetricCard label="Hot leads" value={metrics.hotLeads} hint="Commercial intent captured from content" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="eyebrow">Launch path</div>
            <h3 className="mt-2 text-2xl font-semibold">Get the workflow tight, then scale the volume</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Repurly should feel premium on the surface and operator-grade underneath. These are the steps that keep both true.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {setup.steps.map((step, index) => (
              <div key={step.key} className={`rounded-[1.5rem] border p-5 ${statusClasses(step.status)}`}>
                <div className="text-sm font-medium opacity-80">Step {index + 1}</div>
                <h4 className="mt-2 text-lg font-semibold">{step.title}</h4>
                <p className={step.status === 'current' ? 'mt-2 text-slate-200' : step.status === 'complete' ? 'mt-2 text-emerald-900/80' : 'mt-2 text-slate-500'}>
                  {step.description}
                </p>
                <Link href={step.href} className={step.status === 'current' ? 'mt-4 inline-flex items-center gap-2 font-medium text-white' : 'mt-4 inline-flex items-center gap-2 font-medium text-primary'}>
                  Open step <ArrowRight className="size-4" />
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="eyebrow">Next up in the queue</div>
            <h3 className="mt-2 text-2xl font-semibold">Operator confidence view</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The queue should tell a workspace what is going live, where it is going, and what needs intervention before trust breaks.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextQueued.length ? nextQueued.map((item) => (
              <a key={item.id} href={item.postId ? `/app/content?postId=${item.postId}` : '/app/calendar'} className="block rounded-[1.5rem] border border-slate-200/80 px-4 py-4 transition hover:border-primary/30 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.brandName} · {item.targetLabel}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{item.status}</span>
                </div>
              </a>
            )) : (
              <div className="rounded-[1.5rem] border border-dashed border-border p-6 text-sm text-muted-foreground">
                Nothing is scheduled yet. Once posts are queued, this view becomes the operator’s single source of truth.
              </div>
            )}
            <Link href="/app/calendar" className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              Open the full calendar and queue <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CheckCircle2 className="size-5 text-emerald-500" />
            <h3 className="mt-3 text-lg font-semibold">Workflow moat</h3>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Approval routing, queue visibility, retry recovery, and multi-brand operations remain the category wedge.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Sparkles className="size-5 text-violet-500" />
            <h3 className="mt-3 text-lg font-semibold">Creative parity</h3>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            The studio, templates, carousel planning, and asset framing should now feel premium instead of operational-only.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <ShieldCheck className="size-5 text-cyan-500" />
            <h3 className="mt-3 text-lg font-semibold">Publish reliability</h3>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Reliability is still a front-of-house feature. Customers should feel confidence, not hidden operator complexity.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
