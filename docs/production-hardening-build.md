# Repurly v2 Production Hardening Build

This build focuses on the upgrades that matter most before a real commercial launch:

- provider-aware retry posture
- publish idempotency keys
- webhook/email ops alert scaffolding
- token expiry warning posture
- plan-aware usage limits
- dedicated reliability and billing surfaces in-app

## What changed

### Reliability
- `publish_jobs` now supports an `idempotency_key`
- the Inngest publish flow now distinguishes between:
  - `completed`
  - `retry_scheduled`
  - `failed`
- permanent failures trigger an ops alert via webhook and/or email
- token expiry warnings can also trigger ops alerts

### Commercial controls
- plan limits live in `src/lib/billing/plans.ts`
- the app now has a `/app/billing` surface for usage and upgrade posture
- the settings area links into billing and reliability

### Operator awareness
- the app now has a `/app/reliability` surface
- alert delivery can be wired to:
  - `ALERT_WEBHOOK_URL`
  - `ALERT_EMAIL_TO`

## Final hardening still worth doing
- persist alert events in the database after delivery
- wire live usage calculations from publish/jobs/assets/memberships
- add webhook intake per provider where available
- add Sentry instrumentation around publish flows
- add reauth nudges in customer-facing channel setup UX
