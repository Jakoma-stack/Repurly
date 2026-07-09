import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getProofScoreSnapshot } from '@/server/queries/opportunity';

function scoreColour(score: number) {
  if (score >= 85) return 'bg-emerald-600';
  if (score >= 70) return 'bg-indigo-600';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function metricLabel(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

export default async function ProofScorePage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const data = await getProofScoreSnapshot(session.workspaceId);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-950 p-6 text-white">
        <div className="eyebrow !text-white/50">Beta proof score</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Is Repurly behaving like a 10/10 opportunity desk?</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">
          This is the practical readiness view. It measures whether users are forming the habit, acting on recommendations, logging relationship memory, configuring opportunity rules and avoiding weak DMs.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Private beta readiness</h2>
            <p className="text-sm text-muted-foreground">Use this before inviting more beta users or increasing pricing.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="text-6xl font-semibold tracking-tight text-slate-950">{data.score}</div>
              <div className="pb-2 text-sm font-medium uppercase tracking-[0.16em] text-slate-500">/ 100</div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${scoreColour(data.score)}`} style={{ width: `${data.score}%` }} />
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-800">Current band: {data.band}</div>
            <div className="mt-5 grid gap-3 text-sm">
              {Object.entries(data.scoreBreakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-slate-600">{metricLabel(key)}</span>
                  <span className="font-semibold text-slate-950">{value}/20</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><h2 className="text-xl font-semibold">What is working</h2></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {data.strengths.length ? data.strengths.map((item) => <div key={item} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-950">{item}</div>) : <div className="rounded-2xl bg-slate-50 p-4 text-muted-foreground">No proof strengths yet. Run real sessions and act on outputs.</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h2 className="text-xl font-semibold">Blockers to 10/10</h2></CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {data.blockers.length ? data.blockers.map((item) => <div key={item} className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-950">{item}</div>) : <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-950">No major proof blockers from current usage.</div>}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader><div className="text-sm text-muted-foreground">7-day sessions</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.weekly.metrics.sessions}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Copied/sent/approved</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.weekly.metrics.copiedOrSent}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Logged relationships</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.weekly.metrics.logged}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">No-DM discipline</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.weekly.metrics.noDm}</div></CardContent></Card>
        <Card><CardHeader><div className="text-sm text-muted-foreground">Configured brands</div></CardHeader><CardContent><div className="text-3xl font-semibold">{data.configuredBrands}/{data.settings.length}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">30-day validation target</h2>
          <p className="text-sm text-muted-foreground">This is the product proof that matters more than new features.</p>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          {[
            '3 paying assisted beta users or 5 active free testers.',
            'Each active user runs 3+ Daily Agent sessions per week.',
            'Each user copies/sends/logs 5+ recommended actions per week.',
            'Bad DM recommendations stay at zero.',
            'Every user completes Opportunity Settings before judging output quality.',
            'At least one user says they would miss Repurly if it disappeared.',
            'Weekly Plan creates at least 3 useful next actions from real data.',
            'Analytics import changes at least one content or follow-up decision.',
          ].map((item) => <div key={item} className="rounded-2xl bg-slate-50 p-4">{item}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}
