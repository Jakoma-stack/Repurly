# Repurly commercial-ready pack change report

This package starts from `Repurly-hardened.zip` and applies the fixes that can be completed without access to the owner's private production accounts.

## Completed code changes

- Fixed invalid upload filename regex in `src/app/api/uploads/presign/route.ts`.
- Changed upload object keys to `workspaces/{workspaceId}/uploads/{uuid}-{filename}`.
- Removed Stripe's unsafe placeholder fallback key.
- Added lazy fail-closed Stripe client initialisation.
- Made `OAUTH_STATE_SECRET` required by env validation.
- Wired env validation into `next.config.ts`.
- Added `SKIP_ENV_VALIDATION=false` to `.env.example`.
- Added `/api/health`.
- Added `src/lib/billing/enforce-limits.ts`.
- Added server-side plan limit checks for:
  - brand creation,
  - monthly post creation,
  - AI draft batch creation,
  - newly connected platform accounts.
- Added `stripe_webhook_events` schema/migration.
- Added duplicate Stripe webhook skip logic.
- Added `scripts/commercial-readiness-check.mjs`.
- Added `npm run commercial:check`.
- Added `npm run commercial:verify`.
- Added `docs/OWNER_COMMERCIAL_READINESS_GUIDE.md`.

## Not completed because only the owner can do them

- Production Clerk setup.
- Production Stripe products, prices, checkout, portal, and webhooks.
- LinkedIn developer app approval/configuration.
- Production database creation and migrations against the real database.
- Production S3/R2 bucket setup.
- Domain/DNS/hosting setup.
- Legal documents.
- Closed beta with real users.
- Live end-to-end publishing.

## Required owner verification

Run these locally after filling `.env.local`:

```bash
npm ci
npm run commercial:check
npm run typecheck
npm run lint
npm run build
npm run commercial:verify
```

Then deploy to staging and follow `docs/OWNER_COMMERCIAL_READINESS_GUIDE.md`.
