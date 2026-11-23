# Railway migration – guarded rollout

Created 23 November 2026. This repository must not be treated as a live migration until all gates pass.

## Deployment
- Railway project: repurly (Jakoma's Projects), staging environment first.
- Render production/staging services are suspended and must not be deleted as a shortcut.
- Keep original database and object storage unchanged until backups and origins are verified.
- Build from the reviewed fix branch. Promote to main only after tests pass.
- Configure Node 20, npm ci, npm run build, npm run start, and /api/health.
- Do not point the custom domain to Railway before health, billing, OAuth and data migration pass.

## Required credentials and dependencies
- Actual DATABASE_URL and verified backups; no managed Postgres was found in the connected Render account.
- Clerk publishable/secret key and redirect/origin configuration.
- Stripe webhook/price credentials (test mode in staging).
- OpenAI key, correct usage budget.
- Inngest event and signing keys; existing schedules must not run twice.
- Resend mail credentials and verified sender.
- S3/R2 storage bucket and access credentials; do not create a new bucket as a substitute for existing customer files.
- LinkedIn/Meta/X provider secrets and OAuth callbacks; never reuse production credentials for unsafe test posts.
- TOKEN_ENCRYPTION_SECRET and OAUTH_STATE_SECRET. Never regenerate keys for existing encrypted tokens.

## Safety gates
1. GitHub repository visibility and past disclosed contact names reviewed by owner. Removing source does not erase Git history.
2. CI tests, build and a two-user tenant-isolation test pass.
3. Real Responses API result parsed correctly; no silent fallback for valid output.
4. Beta bypass confined to explicitly listed workspace IDs and disabled in production.
5. CSV imports validated; Excel imports intentionally disabled pending maintained parser.
6. Stripe test checkout, billing state, webhooks and cancelled subscriptions verified.
7. External OAuth callbacks and scheduling jobs verified without duplicate sends.
8. Staging uptime and /api/health return 200 with a real database.
9. Backups and rollback to Render/existing infrastructure documented and tested.

## Current limitations
- This branch is a remediation candidate, not a production approval.
- The deployment connector cannot extract Render application secret values.
- A separate, approved credential transfer is required for a functional staging instance.
