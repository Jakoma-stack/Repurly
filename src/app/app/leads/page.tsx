import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { updateLeadStage } from '@/server/actions/engagement';
import { getEngagementSnapshot } from '@/server/queries/engagement';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const stages = ['new', 'contacted', 'qualified', 'nurture', 'closed'] as const;

function MetricCard({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <a href={href} className="block transition hover:-translate-y-0.5">
      <Card>
        <CardHeader><div className="text-sm text-muted-foreground">{label}</div></CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{value}</div>
          <div className="mt-2 text-xs text-muted-foreground">Filter this pipeline view</div>
        </CardContent>
      </Card>
    </a>
  );
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const params = await searchParams;
  const stage = firstParam(params.stage);
  const ok = firstParam(params.ok);
  const data = await getEngagementSnapshot(session.workspaceId, stage ?? null);

  return (
    <div className="space-y-6">
      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Lead updated.</div> : null}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard href="/app/leads?stage=qualified" label="Hot leads" value={data.metrics.hotLeads} />
        <MetricCard href="/app/engagement#engagement-queue" label="Pending replies" value={data.metrics.pendingReplies} />
        <MetricCard href="/app/leads?stage=qualified" label="Qualified" value={data.metrics.qualifiedLeads} />
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Lead pipeline</h2>
          <p className="text-sm text-muted-foreground">Use new for fresh intent, contacted after a reply or DM, and qualified once there is a real commercial next step.</p>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <a href="/app/leads" className={`rounded-2xl px-3 py-2 text-sm ${!stage ? 'bg-slate-900 text-white' : 'border border-border'}`}>All</a>
            {stages.map((item) => <a key={item} href={`/app/leads?stage=${item}`} className={`rounded-2xl px-3 py-2 text-sm ${stage === item ? 'bg-slate-900 text-white' : 'border border-border'}`}>{item}</a>)}
          </div>
          <div className="space-y-4">
            {data.leads.length ? data.leads.map((lead) => (
              <div key={lead.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-900">{lead.leadName} <span className="text-sm text-muted-foreground">{lead.leadHandle}</span></div>
                    <div className="text-sm text-muted-foreground">{lead.brandName || 'No brand'} · {lead.intentScore}/100 intent</div>
                    <div className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{lead.commentText || 'No source comment stored.'}</div>
                  </div>
                  <form action={updateLeadStage} className="grid gap-3 rounded-2xl border border-border p-4 md:min-w-[320px]">
                    <input type="hidden" name="workspaceId" value={session.workspaceId} />
                    <input type="hidden" name="leadId" value={lead.id} />
                    <select name="stage" defaultValue={lead.stage} className="rounded-2xl border border-border px-4 py-3 text-sm">
                      {stages.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <input name="nextAction" defaultValue={lead.nextAction ?? ''} className="rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Next action" />
                    <textarea name="notes" defaultValue={lead.notes ?? ''} className="min-h-[90px] rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Notes" />
                    <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Update lead</button>
                  </form>
                </div>
              </div>
            )) : <div className="text-sm text-muted-foreground">No leads in this stage yet.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
