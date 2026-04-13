import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LocalDateTime } from '@/components/workflow/local-date-time';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { isFlagEnabled } from '@/lib/ops/feature-flags';
import { clearQueuedPosts } from '@/server/actions/workflow';
import { getPublishingQueue } from '@/server/queries/workflow';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CalendarPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const [queue, publishingPaused, params] = await Promise.all([
    getPublishingQueue(session.workspaceId),
    isFlagEnabled(session.workspaceId, 'pause_publishing'),
    searchParams ?? Promise.resolve({}),
  ]);
  const ok = firstParam(params.ok);

  return (
    <div className="space-y-6">
      {ok === 'queue-cleared' ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Queued publish jobs cleared.</div> : null}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Calendar and queue</h2>
              <p className="mt-2 text-sm text-muted-foreground">The operator view focuses on what is scheduled next, what is retrying, and what needs intervention.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/app/settings" className="rounded-2xl border border-border px-4 py-2 text-sm font-medium text-primary">Operator controls</Link>
              <form action={clearQueuedPosts}>
                <input type="hidden" name="workspaceId" value={session.workspaceId} />
                <input type="hidden" name="authorId" value={session.userId} />
                <button className="rounded-2xl border border-border px-4 py-2 text-sm font-medium text-slate-700">Clear queued posts</button>
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {publishingPaused ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Publishing is paused in operator controls. New posts should not be scheduled until the pause is lifted.
            </div>
          ) : null}
          <div className="rounded-2xl border border-border bg-slate-50 p-4 text-sm text-slate-600">
            Scheduling places the post into Repurly&apos;s publish queue. Automatic posting depends on the background publish worker reaching <span className="font-medium text-slate-900">/api/inngest</span> on a live schedule. If items remain queued, check your worker or cron setup first.
          </div>
          {queue.length ? queue.map((item) => {
            const content = (
              <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-slate-50 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-muted-foreground"><LocalDateTime value={item.scheduledForIso} /></div>
                  <div className="mt-1 font-medium text-slate-900">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.targetLabel} · {item.provider}</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{item.status}</div>
              </div>
            );

            return item.postId ? (
              <a key={item.id} href={`/app/content?postId=${item.postId}`} className="block">
                {content}
              </a>
            ) : (
              <div key={item.id}>{content}</div>
            );
          }) : (
            <div className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">Nothing is scheduled yet. Once a post is queued, it will show up here with its target and current status.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
