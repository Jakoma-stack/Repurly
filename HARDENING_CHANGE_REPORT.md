# Repurly hardening change report

This zip applies a targeted security/readiness pass to the uploaded Repurly codebase.

## Main changes

- Added central workspace role helpers in `src/lib/auth/workspace.ts`.
- Gated server actions by role instead of trusting hidden form fields.
- Derived workflow `authorId` and approval `responderId` from the authenticated Clerk user.
- Validated brand IDs, post IDs, approval IDs, publish-job IDs, and activity records against the current workspace before mutation/read.
- Scoped publish activity list/detail queries to the active workspace.
- Replaced unsigned base64 OAuth state with signed, expiring HMAC state bound to the initiating Clerk user.
- Required owner/admin role for social account connection/callback completion.
- Hardened presigned upload creation with membership checks, MIME allowlist, max byte size, and filename sanitisation.
- Changed token encryption to fail closed if `TOKEN_ENCRYPTION_SECRET` is missing or too short.
- Added optional `OAUTH_STATE_SECRET` to environment validation and `.env.example`.
- Normalised the workspace invite migration from duplicate `0001_*` numbering to `0002_workspace_invites.sql` and updated Drizzle journal metadata.
- Removed `.git` and stray command-output files from the delivered zip.

## Important verification note

The sandbox could not complete a clean dependency install within the available runtime, so `npm run typecheck`, `npm run lint`, and `npm run build` still need to be run in your normal Node 20 environment after unzipping.

Recommended commands:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

## Remaining work before calling this production-strong

- Add automated cross-tenant authorization tests for every server action and API route.
- Add OAuth callback replay/forgery tests.
- Add upload abuse/rate-limit tests.
- Confirm all provider publish paths, especially media publishing, against sandbox provider accounts.
- Add live E2E tests for signup, workspace switching, channel connect, content creation, approval, schedule, and retry.
