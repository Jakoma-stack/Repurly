# Delivery logs, retry guidance, and notification channels build

This build adds three production-facing upgrades on top of the provider-correlation and delivery-log foundation:

1. **Delivery logs inside job detail**
   - Job detail now shows the provider callback / delivery timeline, not just the raw provider payload.
   - Operators can see correlation IDs, provider states, and payload snapshots without leaving the job screen.

2. **Provider-specific retry guidance**
   - Job detail now renders recovery advice based on provider and latest stored outcome.
   - Instagram guidance focuses on container readiness and page ownership.
   - X guidance focuses on reconnecting when posting scopes drift.
   - YouTube guidance warns against replaying jobs before upload processing completes.

3. **Customer notification channels backed by real outcomes**
   - Added `notification_preferences` and `notification_deliveries` tables.
   - Provider callbacks and publish workflow outcomes now create in-app/email notification delivery records.
   - The notifications center reflects channel + delivery status for live outcomes.
   - Added `/app/settings/notifications` for workspace-level notification preferences.

## New tables
- `notification_preferences`
- `notification_deliveries`

## Key files
- `src/server/queries/publish-activity-detail.ts`
- `src/components/activity/activity-detail.tsx`
- `src/lib/notifications/retry-guidance.ts`
- `src/lib/notifications/delivery.ts`
- `src/server/queries/notifications.ts`
- `src/components/notifications/notifications-center.tsx`
- `src/app/app/settings/notifications/page.tsx`

## Remaining hardening step
The next natural step is a real digest sender and unsubscribe logic, so queued daily-digest notification deliveries are actually flushed on schedule rather than simply stored with `queued_digest` status.
