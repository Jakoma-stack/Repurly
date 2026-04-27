# Repurly v2 Webhooks, Usage Metering, and Reconnect Nudges Build

This build adds the next production layer after the hardening pass:

- provider webhook intake surfaces for Meta, X, and YouTube
- live usage metering helpers backed by `usage_events`
- customer-facing reconnect nudges for expiring or broken channel authorizations
- billing usage screens that can read live metering instead of static snapshot data

## What is new

### Webhook routes
- `src/app/api/webhooks/meta/route.ts`
- `src/app/api/webhooks/x/route.ts`
- `src/app/api/webhooks/youtube/route.ts`

These routes are designed as intake surfaces so provider callbacks can land in the app, write audit data, and feed future workflow/status logic.

### Usage metering
- `src/lib/usage/metering.ts`
- `src/server/queries/billing.ts`

The publish workflow now records a `published_post` usage event on successful completion. This gives you a real path to plan-aware usage reporting and future hard limits.

### Reconnect nudges
- `src/components/channels/reconnect-nudges.tsx`

The channel experience now surfaces customer-facing warnings before posts fail. This should evolve into workspace-specific nudges once the live auth records are fully wired into your session-aware query layer.

## Notes

This is still a serious scaffold rather than live provider verification. You must still:
- configure provider webhook secrets/tokens
- point provider dashboards at the correct callback URLs
- test each webhook path with real provider payloads
- wire workspace resolution from provider account IDs instead of fallback placeholders

## Environment additions
- `META_WEBHOOK_VERIFY_TOKEN`
- `X_WEBHOOK_SECRET`
- `YOUTUBE_WEBHOOK_SECRET`
- `ENABLE_LIVE_USAGE_METERING`
- `RECONNECT_WARNING_DAYS`
