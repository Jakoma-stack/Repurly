import { ActivityFeed } from '@/components/activity/activity-feed';
import { ActivityOverview } from '@/components/activity/activity-overview';
import { getPublishActivity } from '@/server/queries/publish-activity';

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const status = typeof params.status === 'string' ? params.status : 'all';
  const provider = typeof params.provider === 'string' ? params.provider : 'all';
  const q = typeof params.q === 'string' ? params.q : '';

  const data = await getPublishActivity({
    status: status as never,
    provider: provider as never,
    q,
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Publish history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See what went live, what is still processing, and which posts need action before customers notice friction.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Mode: <span className="font-medium text-slate-700">{data.dataSource}</span>
        </div>
      </section>
      <ActivityOverview highlights={data.highlights} />
      <ActivityFeed
        items={data.items}
        filters={data.filters}
        availableProviders={data.availableProviders}
        availableStatuses={data.availableStatuses}
      />
    </div>
  );
}
