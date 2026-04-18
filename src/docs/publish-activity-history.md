# Publish activity and operator actions

The activity layer now supports two modes:

- **Database-backed mode** when `DATABASE_URL` is configured and the `publish_jobs`, `post_targets`, `posts`, and `platform_accounts` tables are available.
- **Snapshot fallback mode** for local preview or design review when a live database is not configured.

## Filters

The `/app/activity` view now supports:

- free-text search
- provider filter
- status filter

These filters are implemented as URL query params so operators can bookmark or share filtered views.

## Retry and requeue actions

The activity feed supports two operator actions:

- **Retry now**: resets a failed `publish_job` back to `queued` and clears the last error.
- **Requeue**: moves a `post_target` and linked `publish_job` back into the queue so it can be picked up by the workflow engine again.

These actions are implemented as Next.js server actions in:

- `src/server/actions/publish-activity.ts`

## Recommended next step

Wire the activity screen to your real workflow engine events so job transitions also write:

- provider-native status code
- retryability
- recommended action
- live post URL
- container or upload id

That will keep the UX stable while letting each platform expose richer provider detail.

## Job detail view

The activity layer now includes a dedicated route at `/app/activity/[jobId]`.

This view is intended to behave like an operator console for a single publish attempt. It surfaces:
- raw provider payloads and stored result JSON
- provider/container/upload/media identifiers
- audit trail entries across the job, post target, and post
- manual recovery controls for retry and requeue

When `DATABASE_URL` is configured, the detail route reads from `publish_jobs`, `post_targets`, `posts`, `platform_accounts`, and `audit_events`. Without a live database it falls back to structured snapshot data so the UI still renders in preview mode.
