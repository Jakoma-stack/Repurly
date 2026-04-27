# Provider correlation IDs + delivery logs build

This build adds a more production-grade publish trace model so provider callbacks can map back to the correct publish record without relying only on loose matching.

## What changed

### 1. Provider-native correlation IDs
Repurly now stores provider-native identifiers on both `publish_jobs` and `post_targets`:
- `provider_correlation_id`
- `provider_container_id`
- `provider_upload_id`

These are extracted from adapter publish results at publish time and persisted immediately.

### 2. Delivery logs table
A new `delivery_logs` table captures:
- workspace
- publish job
- post target
- provider
- event type
- provider status
- correlation ID
- payload snapshot
- human-readable message

This gives the app a live delivery signal stream instead of relying only on generic alert events.

### 3. Webhook correlation
Provider callbacks now try to correlate by:
1. `provider_correlation_id`
2. `provider_container_id`
3. `provider_upload_id`

When a match is found, the callback updates the publish record and writes a delivery log row.

### 4. Notifications center
The notifications query now includes recent delivery log items so customers can see:
- recent provider callback activity
- current provider status
- correlation IDs
- direct links to activity/job detail

## Production follow-up

To make this fully live in production you should:
- add DB migrations for the new columns/table
- ensure each platform adapter returns provider IDs consistently
- preserve provider IDs from upload creation through final publish
- feed provider delivery logs into the activity/job detail read model too
- add retention/archival rules for `delivery_logs`
