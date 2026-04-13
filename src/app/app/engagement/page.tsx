import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { generateEngagementReply, markReplySent, saveEngagementComment } from '@/server/actions/engagement';
import { getEngagementSnapshot } from '@/server/queries/engagement';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function MetricCard({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <a href={href} className="block transition hover:-translate-y-0.5">
      <Card>
        <CardHeader><div className="text-sm text-muted-foreground">{label}</div></CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{value}</div>
          <div className="mt-2 text-xs text-muted-foreground">Open related queue</div>
        </CardContent>
      </Card>
    </a>
  );
}

export default async function EngagementPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const params = await searchParams;
  const ok = firstParam(params.ok);
  const data = await getEngagementSnapshot(session.workspaceId, null);

  return (
    <div className="space-y-6">
      {ok ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Engagement workflow updated.</div> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="#engagement-queue" label="Comments captured" value={data.metrics.commentsTotal} />
        <MetricCard href="#engagement-queue" label="Pending replies" value={data.metrics.pendingReplies} />
        <MetricCard href="/app/leads?stage=qualified" label="Hot leads" value={data.metrics.hotLeads} />
        <MetricCard href="/app/leads?stage=qualified" label="Qualified" value={data.metrics.qualifiedLeads} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Capture a LinkedIn comment</h2>
            <p className="text-sm text-muted-foreground">Manual-first for now. This keeps the feature useful without pretending to be a full synced social inbox yet.</p>
          </CardHeader>
          <CardContent>
            <form action={saveEngagementComment} className="space-y-4">
              <input type="hidden" name="workspaceId" value={session.workspaceId} />
              <div>
                <label className="text-sm font-medium text-slate-900">Brand</label>
                <select name="brandId" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm">
                  <option value="">No brand selected</option>
                  {data.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><label className="text-sm font-medium text-slate-900">Commenter name</label><input name="commenterName" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" required /></div>
                <div><label className="text-sm font-medium text-slate-900">Handle</label><input name="commenterHandle" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="@name" /></div>
              </div>
              <div><label className="text-sm font-medium text-slate-900">Source post title</label><input name="sourcePostTitle" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" /></div>
              <div><label className="text-sm font-medium text-slate-900">Comment text</label><textarea name="commentText" className="mt-2 min-h-[140px] w-full rounded-2xl border border-border px-4 py-3 text-sm" required /></div>
              <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Capture comment</button>
            </form>
          </CardContent>
        </Card>

        <Card id="engagement-queue" className="scroll-mt-24">
          <CardHeader>
            <h2 className="text-xl font-semibold">Engagement queue</h2>
            <p className="text-sm text-muted-foreground">Score intent, generate replies, and move the best signals into the lead workflow.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.comments.length ? data.comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{comment.commenterName} <span className="text-sm text-muted-foreground">{comment.commenterHandle}</span></div>
                    <div className="text-sm text-muted-foreground">{comment.brandName || 'No brand'} · {comment.sourcePostTitle || 'Recent LinkedIn post'}</div>
                  </div>
                  <div className="text-sm text-slate-700">{comment.intentLabel} · {comment.intentScore}/100</div>
                </div>
                <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{comment.commentText}</div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <form action={generateEngagementReply}>
                    <input type="hidden" name="workspaceId" value={session.workspaceId} />
                    <input type="hidden" name="commentId" value={comment.id} />
                    <button className="rounded-2xl border border-border px-3 py-2 text-sm">Generate AI reply</button>
                  </form>
                </div>

                {comment.metadata ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><div className="font-medium text-slate-900">AI qualification</div><div className="mt-1">{String((comment.metadata as { aiQualificationSummary?: string }).aiQualificationSummary ?? 'No AI qualification summary yet.')}</div></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><div className="font-medium text-slate-900">Next best action</div><div className="mt-1">{String((comment.metadata as { aiNextBestAction?: string }).aiNextBestAction ?? 'Generate a reply to get a recommendation.')}</div></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700"><div className="font-medium text-slate-900">Escalation</div><div className="mt-1">{String((comment.metadata as { aiEscalationRecommendation?: string }).aiEscalationRecommendation ?? 'No escalation recommendation yet.')}</div></div>
                  </div>
                ) : null}

                {comment.replyOptions?.length ? (
                  <form action={markReplySent} className="mt-4 space-y-3 rounded-2xl border border-border p-4">
                    <input type="hidden" name="workspaceId" value={session.workspaceId} />
                    <input type="hidden" name="commentId" value={comment.id} />
                    <div>
                      <label className="text-sm font-medium text-slate-900">Reply option</label>
                      <select name="replyText" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm" defaultValue={comment.replyOptions[0]}>
                        {comment.replyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-900">DM draft</label>
                      <textarea name="dmText" defaultValue={comment.suggestedDmText ?? ''} className="mt-2 min-h-[100px] w-full rounded-2xl border border-border px-4 py-3 text-sm" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="sendDm" value="yes" /> Mark DM as drafted too</label>
                    <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Mark reply sent</button>
                  </form>
                ) : null}
              </div>
            )) : <div className="text-sm text-muted-foreground">No comments captured yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
