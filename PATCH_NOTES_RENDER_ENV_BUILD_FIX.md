# Render build fix: Next config and build-time env validation

## Problem

Render was failing before the app build completed:

```txt
Failed to load next.config.ts
ZodError: S3_ACCESS_KEY_ID String must contain at least 1 character(s)
```

The live `commercial-test-suite` branch still imported `src/lib/env` from `next.config.ts`, which forced full runtime secret validation while Next.js was loading configuration.

## Fixes included

1. `next.config.ts` no longer imports `src/lib/env`.
2. `src/lib/env/index.ts` now treats blank environment variables as missing values instead of invalid empty strings.
3. Full runtime validation remains in place, but build-time validation is relaxed when `npm_lifecycle_event=build`, `NEXT_PHASE=phase-production-build`, or `SKIP_ENV_VALIDATION=true`.

## Still required for live use

Set real production values in Render for all required commercial/live-service variables before using this with customers, especially:

- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_REGION`
- `OAUTH_STATE_SECRET`
- `TOKEN_ENCRYPTION_SECRET`

Use separate high-entropy values for `OAUTH_STATE_SECRET` and `TOKEN_ENCRYPTION_SECRET`.
