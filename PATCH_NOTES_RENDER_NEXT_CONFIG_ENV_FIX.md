# Render build fix: next.config.ts must not validate runtime env

## Problem

Render failed before the Next.js build started:

- `Failed to load next.config.ts`
- `S3_ACCESS_KEY_ID` was present but empty
- `OAUTH_STATE_SECRET` was missing

The root cause was `next.config.ts` importing `src/lib/env`. Next.js loads `next.config.ts` very early, so strict runtime secret validation ran while loading configuration rather than when the relevant runtime feature was used.

## Fix applied

`next.config.ts` now only exports Next config and does **not** import `src/lib/env`.

This allows the application to build while still keeping runtime protections in the actual feature code:

- S3 operations still throw if S3 settings are missing.
- OAuth state generation still requires a 32+ character secret before OAuth can start.
- Token encryption still requires a 32+ character `TOKEN_ENCRYPTION_SECRET` before token encryption/decryption can run.
- `npm run commercial:check` still validates the full production readiness environment before launch.

## Render action still required

For full live customer use, add proper Render environment variables rather than placeholders, especially:

- `OAUTH_STATE_SECRET` — generate a new random 32+ character value.
- `TOKEN_ENCRYPTION_SECRET` — generate a different random 32+ character value.
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` — required before media upload/storage features are used.

Do not set `SKIP_ENV_VALIDATION=true` in staging or production as a permanent workaround.
