import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CopyButton } from '@/components/daily-agent/copy-button';
import { ExportDailyPlan } from '@/components/daily-agent/export-plan';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { createDailyAgentSession, logDailyAgentActionToRelationship, updateDailyAgentAction, updateDailyAgentFeedback } from '@/server/actions/daily-agent';
import { getDailyAgentSnapshot } from '@/server/queries/daily-agent';

const exampleNotifications = `Anthony Tabbiruka — highest priority partner/referral conversation; hold Tuesday 7 July at 14:00 UK time, do not overstate confirmed unless invite/dial-in is received.
Mostafa El Baroudy followed Tracy. Relevant follower, review only.
Surya S viewed profile. Awareness signal only.
Ricardo J Flores reacted to the policy is not proof carousel. Monitor only.`;

const exampleComments = `Judith Cousineau: This distinction between policy and evidence really matters. A lot of organisations think a policy means governance is covered.
11Protocol: Copilot governance needs an evidence layer, not just a usage policy.
Mark: Great post.`;

const exampleAnalytics = `Aggregate analytics 23 June to 6 July:
1,086 impressions
468 members reached
276 total followers
Senior 38%, Director 18%, CXO 10%
Hospitals and Health Care 25%, IT Services and IT Consulting 16%
Policy is not proof carousel: 135 impressions, 1 profile viewer, 1 follower driven, 2 reactions, 3 comments
Copilot/evidence post: 203 impressions, 3 profile viewers, 1 follower driven`;

function todayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function priorityClass(priority: string) {
  if (priority === 'high') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (priority === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DailyAgentPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const params = await searchParams;
  const activeSessionId = firstParam(params.session);
  const ok = firstParam(params.ok);
  const error = firstParam(params.error);
  const data = await getDailyAgentSnapshot(session.workspaceId, activeSessionId);
  const active = data.activeSession;
  const briefing = active?.briefing;
  const analyticsImport = active?.analyticsImport as { fileName?: string; rowCount?: number; textSummary?: string; warnings?: string[] } | null | undefined;
  const defaultBrand = data.brandOptions[0];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="eyebrow !text-white/50">Opportunity desk</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Daily LinkedIn Opportunity Desk</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
              Paste today’s LinkedIn activity. Repurly explains what changed, who matters, what to reply, what to ignore, what to log, what not to DM, and what to post tomorrow.
            </p>
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/82">
              Repurly drafts. You approve. You post or send. Repurly logs and learns.
            </p>
          </div>
          <div className="w-full rounded-3xl border border-white/10 bg-white/8 p-4 text-sm text-white/75 md:w-80">
            <div className="font-semibold text-white">Beta usage</div>
            <div className="mt-2 text-3xl font-semibold text-white">{data.usage.used}/{data.usage.limit}</div>
            <p className="mt-1">Daily Agent sessions used in this monthly allowance.</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (data.usage.used / data.usage.limit) * 100)}%` }} />
            </div>
          </div>
        </div>
      </section>

      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Daily Agent updated.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Something needs attention: {error}.</div> : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">1. Daily intake form</h2>
                <p className="text-sm text-muted-foreground">Manual-input first. No scraping, no auto-DMs, no risky LinkedIn automation.</p>
              </div>
              <a href="/app/brands" className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Brand settings</a>
            </div>
          </CardHeader>
          <CardContent>
            <form action={createDailyAgentSession} className="space-y-4">
              <input type="hidden" name="workspaceId" value={session.workspaceId} />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Brand voice and offer context
                  <select name="brandId" defaultValue={defaultBrand?.id ?? ''} className="rounded-2xl border border-border px-4 py-3 text-sm">
                    <option value="">Default brand template</option>
                    {data.brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Session date
                  <input type="date" name="sessionDate" defaultValue={todayIsoDate()} className="rounded-2xl border border-border px-4 py-3 text-sm" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Pasted LinkedIn notifications
                  <textarea name="rawNotifications" className="min-h-[170px] rounded-2xl border border-border px-4 py-3 text-sm" placeholder={exampleNotifications} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Pasted comments
                  <textarea name="rawComments" className="min-h-[170px] rounded-2xl border border-border px-4 py-3 text-sm" placeholder={exampleComments} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Simple analytics interpretation input
                  <textarea name="rawAnalytics" className="min-h-[150px] rounded-2xl border border-border px-4 py-3 text-sm" placeholder={exampleAnalytics} />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Profile/contact names to review
                  <textarea name="rawProfiles" className="min-h-[150px] rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Paste names, profile URLs, role/company notes or profile-view signals." />
                </label>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                <label className="grid gap-2 text-sm font-medium text-emerald-950">
                  Upload LinkedIn analytics export
                  <input name="analyticsExport" type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700" />
                </label>
                <p className="mt-2 text-xs leading-5 text-emerald-900/80">
                  Optional. Upload LinkedIn CSV/XLSX analytics exports for a stronger performance review. Repurly parses metrics and audience/post signals, then feeds the summary into the Daily Agent. Screenshots can still be pasted as text; OCR remains later.
                </p>
              </div>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Extra context / Jakoma-style onboarding notes
                <textarea name="rawNotes" className="min-h-[120px] rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Example: Jakoma focuses on AI governance, data assurance and safe AI adoption. Prioritise available vs governed, policy is not proof, evidence before assurance, ownership, controls and practical operating rhythm. Do not pitch from profile views alone." />
              </label>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
                Screenshot/OCR support is intentionally manual in this beta, but LinkedIn analytics export files are now supported. Upload CSV/XLSX analytics exports above and paste important notification/comment text from screenshots so the workflow stays safe, reliable and human-approved.
              </div>
              <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">Generate daily briefing</button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Example input prompts</h2>
            <p className="text-sm text-muted-foreground">Use these to test the beta with Jakoma before connecting any deeper integrations.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-medium text-slate-900">Notifications</div>
                <pre className="mt-2 whitespace-pre-wrap text-slate-600">{exampleNotifications}</pre>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-medium text-slate-900">Comments</div>
                <pre className="mt-2 whitespace-pre-wrap text-slate-600">{exampleComments}</pre>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-medium text-slate-900">Analytics</div>
                <pre className="mt-2 whitespace-pre-wrap text-slate-600">{exampleAnalytics}</pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {briefing && active ? (
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">2. AI-generated daily briefing</h2>
                  <p className="text-sm text-muted-foreground">{active.brandName ?? 'Default brand template'} · {active.sessionDate}</p>
                </div>
                <ExportDailyPlan briefing={briefing} sessionDate={active.sessionDate} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-5 text-sm">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">{briefing.summary}</div>
                {(active.generationMode === 'fallback' || briefing.generationMode === 'fallback') ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Fallback mode used. The workflow is safe and usable, but configure OpenAI for higher-quality briefing intelligence.</div>
                ) : null}
                {analyticsImport?.fileName ? (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                    <h3 className="font-semibold text-emerald-950">Imported analytics export</h3>
                    <p className="mt-1 text-sm text-emerald-900">{analyticsImport.fileName} · {analyticsImport.rowCount ?? 0} rows parsed</p>
                    {analyticsImport.textSummary ? <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-3 text-xs leading-5 text-slate-700">{analyticsImport.textSummary}</pre> : null}
                  </div>
                ) : null}
                <div>
                  <h3 className="font-semibold text-slate-900">What changed</h3>
                  <ul className="mt-2 space-y-2 text-slate-700">
                    {briefing.whatChanged.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Who matters ranking</h3>
                  <div className="mt-2 space-y-2">
                    {briefing.whoMatters.length ? briefing.whoMatters.map((person) => (
                      <div key={`${person.name}-${person.reason}`} className="rounded-2xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{person.name}</div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClass(person.priority)}`}>{person.priority}</span>
                        </div>
                        <p className="mt-1 text-slate-600">{person.reason}</p>
                        <p className="mt-1 text-slate-900">Channel: {person.recommendedChannel.replace(/_/g, ' ')} · Next: {person.suggestedAction}</p>
                      </div>
                    )) : <p className="text-muted-foreground">No people signals yet. Paste notifications, comments or profile names to populate this.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Ignore recommendations</h3>
                  <div className="mt-2 space-y-2">
                    {briefing.ignoreList.length ? briefing.ignoreList.map((item) => (
                      <div key={`${item.item}-${item.reason}`} className="rounded-2xl bg-slate-50 p-3 text-slate-700">
                        <div>{item.item}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.reason}</div>
                      </div>
                    )) : <p className="text-muted-foreground">No obvious noise detected.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Simple analytics interpretation</h3>
                  <p className="mt-2 text-slate-700">{briefing.analyticsReview.interpretation}</p>
                  <ul className="mt-2 space-y-1 text-slate-600">
                    {briefing.analyticsReview.signals.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4">
                  <h3 className="font-semibold text-indigo-950">Tomorrow’s post idea</h3>
                  <div className="mt-2 font-medium text-indigo-950">{briefing.tomorrowContentIdea.hook}</div>
                  <p className="mt-1 text-indigo-900/80">{briefing.tomorrowContentIdea.angle}</p>
                  <textarea readOnly value={briefing.tomorrowContentIdea.draftPost} className="mt-3 min-h-[240px] w-full rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm text-slate-800" />
                  <div className="mt-3"><CopyButton text={briefing.tomorrowContentIdea.draftPost} label="Copy post idea" /></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">3. Copy / approve / log workflow</h2>
              <p className="text-sm text-muted-foreground">Edit drafts before copying. Mark what you approve, send manually, ignore or log to the relationship tracker.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.actions.map((action) => (
                  <div key={action.id} className="rounded-3xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">{action.actionType.replace(/_/g, ' ')}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClass(action.priority)}`}>{action.priority}</span>
                          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">{statusLabel(action.status)}</span>
                          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">{action.recommendedChannel?.replace(/_/g, ' ') ?? 'tracker update'}</span>
                        </div>
                        <div className="mt-2 font-medium text-slate-900">{action.personName || 'General action'}</div>
                        <p className="mt-1 text-sm text-slate-600">{action.reason}</p>
                      </div>
                      {action.linkedLeadId ? <a href="/app/relationships" className="text-sm font-medium text-primary">Logged</a> : null}
                    </div>
                    <form action={updateDailyAgentAction} className="mt-4 space-y-3">
                      <input type="hidden" name="workspaceId" value={session.workspaceId} />
                      <input type="hidden" name="actionId" value={action.id} />
                      <textarea name="draftText" defaultValue={action.draftText ?? ''} className="min-h-[120px] w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Draft text or note" />
                      <div className="flex flex-wrap gap-2">
                        <CopyButton text={action.draftText ?? ''} />
                        {['approved', 'copied', 'sent_manually', 'logged', 'needs_edit', 'ignored'].map((status) => (
                          <button key={status} name="status" value={status} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            {statusLabel(status)}
                          </button>
                        ))}
                      </div>
                    </form>
                    {!['ignore', 'monitor'].includes(action.actionType) ? (
                      <form action={logDailyAgentActionToRelationship} className="mt-3">
                        <input type="hidden" name="workspaceId" value={session.workspaceId} />
                        <input type="hidden" name="actionId" value={action.id} />
                        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Log to relationship tracker</button>
                      </form>
                    ) : null}
                  </div>
                ))}
                {!data.actions.length ? <div className="text-sm text-muted-foreground">Generate a Daily Agent session to see approved-action cards here.</div> : null}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Session history</h2>
            <p className="text-sm text-muted-foreground">Return to previous daily briefings and see what Repurly generated.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.sessions.map((item) => (
                <a key={item.id} href={`/app/daily-agent?session=${item.id}`} className="block rounded-2xl border border-border p-4 transition hover:bg-slate-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">{item.sessionDate} · {item.brandName ?? 'Default brand template'}</div>
                    <span className="text-xs text-slate-500">{item.usefulnessRating ?? 'not rated'}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.summary ?? 'No summary saved.'}</p>
                </a>
              ))}
              {!data.sessions.length ? <div className="text-sm text-muted-foreground">No Daily Agent sessions yet.</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Relationship tracker and follow-up reminders</h2>
            <p className="text-sm text-muted-foreground">Daily Agent actions can be logged here as lightweight LinkedIn relationship intelligence.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.relationships.slice(0, 8).map((lead) => (
                <div key={lead.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{lead.leadName} <span className="text-sm text-slate-500">{lead.leadHandle}</span></div>
                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">{lead.stage}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">Priority score: {lead.intentScore}/100</div>
                  <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{lead.nextAction || 'No next action set.'}</div>
                </div>
              ))}
              {!data.relationships.length ? <div className="text-sm text-muted-foreground">No relationships logged yet. Use “Log to relationship tracker” from the action queue.</div> : null}
              <a href="/app/relationships" className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Open full relationship tracker</a>
            </div>
          </CardContent>
        </Card>
      </section>

      {active ? (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Feedback buttons</h2>
            <p className="text-sm text-muted-foreground">Capture whether the briefing was commercially useful so the beta can improve quickly.</p>
          </CardHeader>
          <CardContent>
            <form action={updateDailyAgentFeedback} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="workspaceId" value={session.workspaceId} />
              <input type="hidden" name="sessionId" value={active.id} />
              <button name="usefulnessRating" value="useful" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Useful</button>
              <button name="usefulnessRating" value="not_useful" className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white">Not useful</button>
              <input name="feedbackNotes" defaultValue={active.feedbackNotes ?? ''} className="min-w-[280px] flex-1 rounded-2xl border border-border px-4 py-3 text-sm" placeholder="What should Repurly learn from this session?" />
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
