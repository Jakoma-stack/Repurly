import Link from 'next/link';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireWorkspaceSession } from '@/lib/auth/workspace';
import { getPublishingQueue } from '@/server/queries/workflow';

export default async function CalendarPage() {
  const session = await requireWorkspaceSession();
  const queue = await getPublishingQueue(session.workspaceId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Calendar and queue</h2>
          <p className="mt-2 text-sm text-muted-foreground">The launch view focuses on what is waiting for approval, what is scheduled next, and what might need operator attention.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {queue.map((item) => {
            const content = (
              <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 transition hover:border-primary/40 hover:bg-slate-50 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{item.scheduledFor}</div>
                  <div className="mt-1 font-medium text-slate-900">{item.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item.targetLabel} · {item.provider}</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{item.status}</div>
              </div>
            );

            return item.postId ? (
              <Link key={item.id} href={`/app/content?postId=${item.postId}`} className="block">
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
