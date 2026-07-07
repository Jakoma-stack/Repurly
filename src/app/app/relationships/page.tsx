import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { updateLeadStage } from '@/server/actions/engagement';
import { getDailyAgentSnapshot } from '@/server/queries/daily-agent';

const stages = ['new_signal', 'review_only', 'public_engagement', 'warm_relationship', 'partner_referral', 'potential_opportunity', 'active_conversation', 'client', 'monitor', 'ignore'] as const;

export default async function RelationshipsPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const data = await getDailyAgentSnapshot(session.workspaceId);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-indigo-950 p-6 text-white">
        <div className="eyebrow !text-white/50">Relationship intelligence</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Relationship tracker</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
          A lightweight LinkedIn relationship tracker for people Repurly finds in comments, notifications, outreach and Daily Agent sessions.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><div className="text-sm text-muted-foreground">Tracked relationships</div></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{data.relationships.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><div className="text-sm text-muted-foreground">Follow-up reminders</div></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{data.relationships.filter((item) => Boolean(item.nextAction)).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><div className="text-sm text-muted-foreground">High priority</div></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{data.relationships.filter((item) => item.intentScore >= 70).length}</div></CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Tracker updates</h2>
          <p className="text-sm text-muted-foreground">Repurly suggests changes, but a human approves the relationship state and next action.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.relationships.map((lead) => (
              <div key={lead.id} className="rounded-3xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{lead.leadName} <span className="text-sm text-slate-500">{lead.leadHandle}</span></div>
                    <div className="mt-1 text-sm text-slate-600">Priority score: {lead.intentScore}/100 · Last updated {lead.updatedAt.toLocaleDateString()}</div>
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{lead.nextAction || 'No follow-up reminder set.'}</div>
                    {lead.notes ? <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-100">{lead.notes}</pre> : null}
                  </div>
                  <form action={updateLeadStage} className="grid gap-3 rounded-2xl border border-border p-4 md:min-w-[320px]">
                    <input type="hidden" name="workspaceId" value={session.workspaceId} />
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="returnTo" value="/app/relationships" />
                    <select name="stage" defaultValue={lead.stage} className="rounded-2xl border border-border px-4 py-3 text-sm">
                      {stages.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
                    </select>
                    <input name="nextAction" defaultValue={lead.nextAction ?? ''} className="rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Next action / reminder" />
                    <textarea name="notes" defaultValue={lead.notes ?? ''} className="min-h-[90px] rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Relationship notes" />
                    <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Update relationship</button>
                  </form>
                </div>
              </div>
            ))}
            {!data.relationships.length ? <div className="text-sm text-muted-foreground">No relationships yet. Generate a Daily Agent session and log an action to create your first tracker entry.</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
