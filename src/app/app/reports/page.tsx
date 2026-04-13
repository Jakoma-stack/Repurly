import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getOperationalReport } from '@/server/queries/reports';

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-50 p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

export default async function ReportsPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const report = await getOperationalReport(session.workspaceId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold">Operational reporting</h2>
          <p className="text-sm text-muted-foreground">A practical reporting surface for drafts, approvals, queue health, delivery outcomes, and lead signals.</p>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Drafts" value={report.posts.drafts} />
        <Metric label="Pending approvals" value={report.approvals.pending} />
        <Metric label="Queued jobs" value={report.publishing.queued} />
        <Metric label="Retrying jobs" value={report.publishing.retrying} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">Content status</h3></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>In review: <strong>{report.posts.inReview}</strong></div>
            <div>Scheduled: <strong>{report.posts.scheduled}</strong></div>
            <div>Published: <strong>{report.posts.published}</strong></div>
            <div>Failed posts: <strong>{report.posts.failed}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">Publishing health</h3></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>Completed jobs: <strong>{report.publishing.completed}</strong></div>
            <div>Failed jobs: <strong>{report.publishing.failed}</strong></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">Engagement and leads</h3></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>Comments captured: <strong>{report.engagement.comments}</strong></div>
            <div>Hot leads: <strong>{report.engagement.hotLeads}</strong></div>
            <div>Qualified leads: <strong>{report.engagement.qualified}</strong></div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Recent failed publish jobs</h3>
          <p className="text-sm text-muted-foreground">Use this as a fast operator view before dropping into Job detail.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.recentFailures.length ? report.recentFailures.map((row) => (
            <div key={row.id} className="rounded-2xl border border-border p-4 text-sm">
              <div className="font-medium text-slate-950">{row.title}</div>
              <div className="mt-1 text-muted-foreground">{row.lastError || 'No error message captured.'}</div>
            </div>
          )) : <div className="text-sm text-muted-foreground">No recent failed publish jobs.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
