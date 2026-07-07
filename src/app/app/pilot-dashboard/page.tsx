import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getPilotDashboardSnapshot } from '@/server/queries/opportunity';

function status(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : 'not rated';
}

export default async function PilotDashboardPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const data = await getPilotDashboardSnapshot(session.workspaceId);

  const activation = data.metrics.sessions >= 3 && data.metrics.logged >= 3;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-cyan-950 p-6 text-white">
        <div className="eyebrow !text-white/50">Pilot dashboard</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Assisted beta operating view</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
          Use this to manage early paid pilots. It shows whether the user is creating daily sessions, acting on recommendations, logging relationships and rating outputs as useful.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><div className="text-sm text-muted-foreground">30-day sessions</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.sessions}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Actions generated</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.actions}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Logged actions</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.logged}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Useful ratings</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.useful}</div></CardContent></Card>
      </section>

      <Card className={activation ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}>
        <CardHeader>
          <h2 className={activation ? 'text-xl font-semibold text-emerald-950' : 'text-xl font-semibold text-amber-950'}>
            {activation ? 'Pilot activation looks healthy' : 'Pilot needs hands-on support'}
          </h2>
        </CardHeader>
        <CardContent className={activation ? 'text-sm leading-6 text-emerald-900' : 'text-sm leading-6 text-amber-900'}>
          {activation
            ? 'The user has created multiple sessions and logged relationship actions. Next step: review whether the outputs are saving time and improving follow-up quality.'
            : 'For a paid pilot, aim for at least three Daily Agent sessions and three logged relationship actions in the first week. Offer assisted setup if they are not reaching that.'}
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="text-xl font-semibold">Recent sessions</h2></CardHeader>
          <CardContent className="space-y-3">
            {data.recentSessions.map((item) => (
              <a key={item.id} href={`/app/daily-agent?session=${item.id}`} className="block rounded-2xl border border-border p-4 transition hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.sessionDate}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary || 'No summary saved.'}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{status(item.usefulnessRating)}</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">Generation mode: {status(item.generationMode)}</div>
              </a>
            ))}
            {!data.recentSessions.length ? <p className="text-sm text-muted-foreground">No Daily Agent sessions in the last 30 days.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Stuck actions</h2>
            <p className="text-sm text-muted-foreground">Draft or needs-edit actions are where assisted beta support can help.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.stuckActions.map((action) => (
              <div key={action.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{action.personName || 'LinkedIn contact'}</div>
                    <div className="mt-1 text-sm text-slate-500">{status(action.recommendedChannel)} · {status(action.status)}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{action.priority}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{action.reason}</p>
              </div>
            ))}
            {!data.stuckActions.length ? <p className="text-sm text-muted-foreground">No stuck actions in the last 30 days.</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
