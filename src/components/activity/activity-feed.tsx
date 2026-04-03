import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCcw, TimerReset } from 'lucide-react';

import { retryPublishJob, requeuePostTarget } from '@/server/actions/publish-activity';
import type { ActivityFilters, ActivityStatus, Provider, PublishActivityItem } from '@/server/queries/publish-activity';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const providerClass: Record<PublishActivityItem['provider'], string> = {
  linkedin: 'bg-blue-50 text-blue-700',
  facebook: 'bg-indigo-50 text-indigo-700',
  instagram: 'bg-fuchsia-50 text-fuchsia-700',
  x: 'bg-slate-100 text-slate-700',
  threads: 'bg-neutral-100 text-neutral-700',
  youtube: 'bg-red-50 text-red-700',
  tiktok: 'bg-emerald-50 text-emerald-700',
};

const statusMeta: Record<
  PublishActivityItem['status'],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  published: { label: 'Published', icon: CheckCircle2, className: 'text-emerald-600' },
  processing: { label: 'Processing', icon: Clock3, className: 'text-amber-600' },
  retrying: { label: 'Retrying', icon: RefreshCcw, className: 'text-blue-600' },
  failed: { label: 'Needs attention', icon: AlertTriangle, className: 'text-rose-600' },
  scheduled: { label: 'Scheduled', icon: TimerReset, className: 'text-slate-600' },
};

function FilterPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {label}
    </span>
  );
}

export function ActivityFeed({
  items,
  filters,
  availableProviders,
  availableStatuses,
}: {
  items: Array<PublishActivityItem>;
  filters: ActivityFilters;
  availableProviders: Array<'all' | Provider>;
  availableStatuses: Array<'all' | ActivityStatus>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Publish activity</h2>
            <p className="text-sm text-muted-foreground">
              Track every publish target through queued, processing, retry, success, and failure states.
            </p>
          </div>
          <form method="GET" className="grid gap-3 rounded-3xl border border-border bg-slate-50 p-4 md:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
            <input
              type="text"
              name="q"
              defaultValue={filters.q}
              placeholder="Search title, channel, or message"
              className="h-11 rounded-2xl border border-border bg-white px-4 text-sm outline-none ring-0 placeholder:text-slate-400"
            />
            <select
              name="provider"
              defaultValue={filters.provider}
              className="h-11 rounded-2xl border border-border bg-white px-4 text-sm"
            >
              {availableProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider === 'all' ? 'All channels' : provider}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={filters.status}
              className="h-11 rounded-2xl border border-border bg-white px-4 text-sm"
            >
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All states' : status}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Apply
              </button>
              <Link href="/app/activity" className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">
                Reset
              </Link>
            </div>
          </form>
          <div className="flex flex-wrap gap-2">
            <FilterPill active={filters.provider === 'all'} label="All channels" />
            <FilterPill active={filters.status === 'published'} label="Published" />
            <FilterPill active={filters.status === 'processing'} label="Processing" />
            <FilterPill active={filters.status === 'retrying'} label="Retrying" />
            <FilterPill active={filters.status === 'failed'} label="Failed" />
            {filters.q ? <FilterPill active label={`Search: ${filters.q}`} /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-slate-50 p-8 text-sm text-muted-foreground">
              No publish activity matched the current filters.
            </div>
          ) : null}
          {items.map((item) => {
            const meta = statusMeta[item.status];
            const Icon = meta.icon;
            const primaryHref =
              item.actionHref ?? (item.publishJobId ? `/app/activity/${item.publishJobId}` : `/app/activity`);

            return (
              <div key={item.id} className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${providerClass[item.provider]}`}>
                        {item.provider}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${meta.className}`}>
                        <Icon className="size-4" />
                        {meta.label}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.postType.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <a href={primaryHref} className="text-lg font-semibold text-slate-900 hover:text-primary">{item.title}</a>
                      <p className="text-sm text-muted-foreground">{item.targetLabel}</p>
                    </div>
                    <div className="grid gap-1 text-sm text-slate-600">
                      <div>{item.summary}</div>
                      <div>{item.userMessage}</div>
                      <div className="text-xs text-muted-foreground">
                        Started {item.relativeStartedAt}
                        {item.relativeNextRetryAt ? ` · ${item.relativeNextRetryAt}` : ''}
                        {item.completedAt ? ' · Completed' : ''}
                        {item.attempts ? ` · ${item.attempts} attempt${item.attempts > 1 ? 's' : ''}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                    {item.actionType === 'retry' && item.publishJobId ? (
                      <form action={retryPublishJob}>
                        <input type="hidden" name="publishJobId" value={item.publishJobId} />
                        <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                          {item.actionLabel ?? 'Retry now'}
                        </button>
                      </form>
                    ) : null}
                    {item.actionType === 'requeue' ? (
                      <form action={requeuePostTarget}>
                        {item.postTargetId ? <input type="hidden" name="postTargetId" value={item.postTargetId} /> : null}
                        {item.publishJobId ? <input type="hidden" name="publishJobId" value={item.publishJobId} /> : null}
                        <button className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                          {item.actionLabel ?? 'Requeue'}
                        </button>
                      </form>
                    ) : null}
                    {item.actionHref && item.actionLabel && !item.actionType ? (
                      <Link href={item.actionHref} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                        {item.actionLabel}
                      </Link>
                    ) : null}
                    {item.externalLabel ? <span className="text-xs font-medium text-primary">{item.externalLabel}</span> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Operational guidance</h2>
          <p className="text-sm text-muted-foreground">
            Make the activity layer feel premium by turning provider noise into clear next actions.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600">
          <div className="rounded-2xl border border-border p-4">
            <div className="font-medium text-slate-900">Processing</div>
            <div className="mt-1">Keep users informed that the provider accepted the request but is still processing media or validating a container.</div>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <div className="font-medium text-slate-900">Retrying</div>
            <div className="mt-1">Show when Repurly is handling the recovery path automatically so customers do not think publishing has stalled.</div>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <div className="font-medium text-slate-900">Needs attention</div>
            <div className="mt-1">Always include a clear next action like reconnecting a channel, replacing media, or re-approving the post.</div>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <div className="font-medium text-slate-900">Operator controls</div>
            <div className="mt-1">Retry or requeue from the activity stream so an operator can recover a failed publish without drilling into raw tables.</div>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <div className="font-medium text-slate-900">Future-proofing</div>
            <div className="mt-1">Store provider-native payloads in job results, but keep shared status and action fields stable across platforms.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
