import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getWeeklyOpportunityPlan } from '@/server/queries/opportunity';

function label(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : 'not set';
}

export default async function WeeklyPlanPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const data = await getWeeklyOpportunityPlan(session.workspaceId);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-teal-950 p-6 text-white">
        <div className="eyebrow !text-white/50">Weekly next-action plan</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Turn the week’s LinkedIn signals into the next five actions</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
          This view converts Daily Agent sessions, relationship updates and reply actions into a practical weekly operating plan. It is intentionally action-led: people, follow-ups, content lanes and ignored noise.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><div className="text-sm text-muted-foreground">Daily sessions</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.sessions}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Actions generated</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.actions}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">No-DM / monitor calls</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.noDm}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Logged relationships</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.metrics.logged}</div></CardContent></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Next 5 actions</h2>
            <p className="text-sm text-muted-foreground">Prioritised from high-signal actions, follow-ups, meeting prep and public replies.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.nextFive.map((action, index) => (
              <div key={action.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-500">Action {index + 1} · {label(action.recommendedChannel)}</div>
                    <h3 className="mt-1 font-semibold text-slate-950">{action.personName || 'LinkedIn contact'}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{action.priority}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{action.reason}</p>
                {action.draftText ? <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{action.draftText}</pre> : null}
              </div>
            ))}
            {!data.nextFive.length ? <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">No weekly actions yet. Generate and log at least one Daily Agent session.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">People to keep warm</h2>
            <p className="text-sm text-muted-foreground">Relationship memory from the tracker. Use this to avoid losing warm signals.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topPeople.map((person) => (
              <div key={person.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{person.leadName}</div>
                    <div className="mt-1 text-sm text-slate-500">{label(person.stage)} · score {person.intentScore}/100</div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{person.nextAction || 'No next action set.'}</p>
              </div>
            ))}
            {!data.topPeople.length ? <div className="text-sm text-muted-foreground">No relationships tracked yet.</div> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader><h2 className="text-xl font-semibold">Content lanes to repeat</h2></CardHeader>
          <CardContent className="space-y-3">
            {data.contentIdeas.map((idea, index) => (
              <div key={`${idea.hook}-${index}`} className="rounded-2xl bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">{idea.hook}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{idea.angle}</p>
              </div>
            ))}
            {!data.contentIdeas.length ? <p className="text-sm text-muted-foreground">No saved content ideas yet.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-xl font-semibold">Analytics signals</h2></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            {data.analyticsSignals.map((signal, index) => <div key={`${signal}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2">{signal}</div>)}
            {!data.analyticsSignals.length ? <p className="text-sm text-muted-foreground">Add analytics in Daily Agent to strengthen this section.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-xl font-semibold">Ignored noise / no-DM discipline</h2></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            {data.noDm.slice(0, 8).map((action) => <div key={action.id} className="rounded-xl bg-slate-50 px-3 py-2">{action.personName || 'LinkedIn contact'} — {label(action.recommendedChannel)}</div>)}
            {!data.noDm.length ? <p className="text-sm text-muted-foreground">No no-DM or monitor decisions logged this week.</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
