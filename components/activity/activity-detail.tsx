import Link from 'next/link';

import { retryPublishJob, requeuePostTarget } from '@/server/actions/publish-activity';
import type { PublishActivityDetail } from '@/server/queries/publish-activity-detail';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-border bg-slate-950 p-4 text-xs text-slate-100">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="max-w-[60%] break-all text-right font-medium text-slate-900">{value ?? '—'}</div>
    </div>
  );
}

function StatusGuidance({ status }: { status: PublishActivityDetail['item']['status'] }) {
  const copy =
    status === 'scheduled'
      ? 'This post is safely queued. Edit it if timing, target, or copy changes.'
      : status === 'failed'
        ? 'This post needs operator action. Confirm channel health, then retry or requeue.'
        : status === 'retrying'
          ? 'Repurly is already attempting recovery. Requeue only if it appears stalled.'
          : status === 'processing'
            ? 'The provider accepted the request. Repurly is waiting for confirmation.'
            : 'This post is live. No recovery action is needed.';

  return (
    <div className="rounded-2xl border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700">
      {copy}
    </div>
  );
}

export function ActivityDetail({ detail }: { detail: PublishActivityDetail }) {
  const item = detail.item;

  const canRetry = item.status === 'failed';
  const canRequeue = item.status === 'failed' || item.status === 'retrying';
  const canEdit = item.status === 'scheduled' && Boolean(item.actionHref);
  const showChannelHealth = item.status === 'failed';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-white p-6 shadow-card md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Link href="/app/activity" className="text-sm font-medium text-primary">
            ← Back to activity
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{item.provider}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{item.status}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{item.postType.replace('_', ' ')}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{detail.dataSource}</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{item.title}</h1>
            <p className="text-sm text-muted-foreground">
              {item.targetLabel} · Started {item.relativeStartedAt}
              {item.relativeNextRetryAt ? ` · ${item.relativeNextRetryAt}` : ''}
            </p>
          </div>
          <StatusGuidance status={item.status} />
          <div className="max-w-3xl text-sm text-slate-600">
            <div className="font-medium text-slate-900">{item.summary}</div>
            <div className="mt-1">{item.userMessage}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <a href={item.actionHref!} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              {item.actionLabel ?? 'Edit post'}
            </a>
          ) : null}

          {canRetry && item.publishJobId ? (
            <form action={retryPublishJob}>
              <input type="hidden" name="publishJobId" value={item.publishJobId} />
              <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Retry now</button>
            </form>
          ) : null}

          {canRequeue && item.postTargetId ? (
            <form action={requeuePostTarget}>
              <input type="hidden" name="postTargetId" value={item.postTargetId} />
              {item.publishJobId ? <input type="hidden" name="publishJobId" value={item.publishJobId} /> : null}
              <button className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">
                Requeue target
              </button>
            </form>
          ) : null}

          {showChannelHealth ? (
            <Link href="/app/channels" className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700">
              Channel health
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Provider payload</h2>
              <p className="text-sm text-muted-foreground">The latest structured payload stored against this publish target.</p>
            </CardHeader>
            <CardContent>
              <JsonBlock value={detail.rawProviderPayload ?? detail.rawResult ?? { note: 'No provider payload stored yet.' }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Delivery outcomes</h2>
              <p className="text-sm text-muted-foreground">Live provider callbacks and publish acceptance events associated with this job.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.deliveryLogTrail.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-5 text-sm text-muted-foreground">
                  No delivery logs were stored for this publish item yet.
                </div>
              ) : null}
              {detail.deliveryLogTrail.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{entry.eventType}</div>
                      <div className="text-xs text-muted-foreground">{entry.relativeCreatedAt}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase">
                      <span className="rounded-full border border-border px-2 py-0.5">{entry.level}</span>
                      {entry.providerStatus ? <span className="rounded-full border border-border px-2 py-0.5">{entry.providerStatus}</span> : null}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{entry.message}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Correlation: {entry.correlationId ?? '—'}</div>
                  {entry.payload ? (
                    <div className="mt-3">
                      <JsonBlock value={entry.payload} />
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Audit trail</h2>
              <p className="text-sm text-muted-foreground">Chronological events for this job, target, and post.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {detail.auditTrail.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-5 text-sm text-muted-foreground">
                  No audit events were found for this publish item yet.
                </div>
              ) : null}
              {detail.auditTrail.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900">{entry.eventType}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.entityType} · {entry.entityId}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{entry.relativeCreatedAt}</div>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">Actor: {entry.actorLabel}</div>
                  {entry.payload ? (
                    <div className="mt-3">
                      <JsonBlock value={entry.payload} />
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Identifiers</h2>
              <p className="text-sm text-muted-foreground">Useful for support, provider debugging, and manual escalation.</p>
            </CardHeader>
            <CardContent>
              <InfoRow label="Publish job ID" value={detail.ids.publishJobId} />
              <InfoRow label="Post target ID" value={detail.ids.postTargetId} />
              <InfoRow label="Post ID" value={detail.ids.postId} />
              <InfoRow label="Platform account ID" value={detail.ids.platformAccountId} />
              <InfoRow label="Provider account ID" value={detail.ids.providerExternalId} />
              <InfoRow label="Container ID" value={detail.ids.containerId} />
              <InfoRow label="Upload ID" value={detail.ids.uploadId} />
              <InfoRow label="Media ID" value={detail.ids.mediaId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Operational summary</h2>
            </CardHeader>
            <CardContent>
              <InfoRow label="Target" value={`${item.targetLabel}${item.targetType ? ` (${item.targetType})` : ''}`} />
              <InfoRow label="Status" value={item.status} />
              <InfoRow label="Attempts" value={String(item.attempts)} />
              <InfoRow label="Started" value={new Date(item.startedAt).toLocaleString()} />
              <InfoRow label="Completed" value={item.completedAt ? new Date(item.completedAt).toLocaleString() : undefined} />
              <InfoRow label="External post ID" value={item.externalId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Retry guidance</h2>
              <p className="text-sm text-muted-foreground">Provider-specific recovery steps based on the last stored outcome.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {detail.retryGuidance.map((entry, idx) => (
                <div key={`${entry.title}-${idx}`} className="rounded-2xl border border-border p-4">
                  <div className="font-medium text-slate-900">{entry.title}</div>
                  <div className="mt-1">{entry.body}</div>
                  {entry.actionHref ? (
                    <a href={entry.actionHref} className="mt-2 inline-block font-medium text-primary">
                      {entry.actionLabel ?? 'Open'}
                    </a>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Customer notifications</h2>
              <p className="text-sm text-muted-foreground">In-app and email deliveries triggered from real publish outcomes.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {detail.notificationDeliveries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-muted-foreground">
                  No customer notifications were queued or sent for this job yet.
                </div>
              ) : null}
              {detail.notificationDeliveries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{entry.channel} · {entry.status}</div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">{entry.subject ?? 'Publish update'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{entry.destination ?? 'workspace destination'}</div>
                  <div className="mt-2 text-sm text-slate-600">{entry.message}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
