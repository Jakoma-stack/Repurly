import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDashboardSnapshot } from '@/server/queries/dashboard';
import { requireWorkspaceSession } from '@/lib/auth/workspace';

export default async function DashboardPage() {
  const session = await requireWorkspaceSession();
  const data = await getDashboardSnapshot(session.workspaceId);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader><div className="text-sm text-muted-foreground">{metric.label}</div></CardHeader>
            <CardContent><div className="text-3xl font-semibold">{metric.value}</div></CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Publishing queue</h2>
              <p className="text-sm text-muted-foreground">What is going out next in the LinkedIn-first launch workflow.</p>
            </div>
            <a href="/app/content"><Button>Create post</Button></a>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span>Need deeper visibility than the queue?</span>
              <a href="/app/activity" className="font-medium text-primary">Open publish history</a>
            </div>
            {data.queue.length ? data.queue.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border p-4">
                <div className="text-sm text-muted-foreground">{item.scheduledFor}</div>
                <div className="mt-1 font-medium">{item.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.brandName} · {item.targetLabel}</div>
                <div className="mt-2 text-sm text-primary">{item.status}</div>
              </div>
            )) : <div className="text-sm text-muted-foreground">Nothing is queued yet.</div>}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-xl font-semibold">Launch discipline</h2></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>1. LinkedIn stays the hero channel.</div>
              <div>2. AI creates drafts, not automatic publishing.</div>
              <div>3. Engagement is manual-first until live sync is hardened.</div>
              <div>4. Leads are a lightweight pipeline, not a full CRM.</div>
              <div>5. Multiple brands support agencies and multi-brand B2B teams without widening into mini-Sprout scope.</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h2 className="text-xl font-semibold">Workflow health</h2></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>Pending replies: {data.workflow.pendingReplies}</div>
              <div>Scheduled posts: {data.workflow.scheduled}</div>
              <div>Published posts: {data.workflow.published}</div>
              <div>Failed jobs: {data.workflow.failed}</div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
