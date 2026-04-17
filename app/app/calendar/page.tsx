import { CalendarClock, ShieldAlert, SendHorizontal } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LocalDateTime } from '@/components/workflow/local-date-time';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { requirePaidWorkspaceAccess } from '@/lib/billing/workspace-billing';
import { getPublishingQueue } from '@/server/queries/workflow';

export default async function CalendarPage() {
  const session = await requireWorkspaceSession();
  await requirePaidWorkspaceAccess(session.workspaceId);
  const queue = await getPublishingQueue(session.workspaceId);
  const queued = queue.filter((item) => item.status === 'queued').length;
  const failed = queue.filter((item) => item.status === 'failed').length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <CalendarClock className="size-5 text-indigo-500" />
            <div className="mt-4 text-3xl font-semibold">{queue.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">Items visible across the publish queue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <SendHorizontal className="size-5 text-cyan-500" />
            <div className="mt-4 text-3xl font-semibold">{queued}</div>
            <div className="mt-1 text-sm text-muted-foreground">Queued items waiting for their publish window</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <ShieldAlert className="size-5 text-rose-500" />
            <div className="mt-4 text-3xl font-semibold">{failed}</div>
            <div className="mt-1 text-sm text-muted-foreground">Exceptions currently visible from the queue</div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="eyebrow">Calendar and queue</div>
          <h2 className="mt-2 text-2xl font-semibold">A premium workflow still needs operator-grade queue visibility</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Scheduling places the post into Repurly&apos;s publish queue. Automatic posting depends on the background publish worker reaching <span className="font-medium text-slate-900">/api/inngest</span> on a live schedule.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {queue.length ? queue.map((item) => {
            const content = (
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200/80 p-4 transition hover:border-primary/30 hover:bg-slate-50 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-muted-foreground"><LocalDateTime value={item.scheduledForIso} /></div>
                  <div className="mt-1 font-medium text-slate-900">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.brandName} · {item.targetLabel} · {item.provider}</div>
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
            <div className="rounded-[1.5rem] border border-dashed border-border p-8 text-sm text-muted-foreground">Nothing is scheduled yet. Once a post is queued, it will show up here with its target and current status.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
