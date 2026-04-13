# Repurly deployment guide

This repository should be deployed through GitHub + Render with a staging-first flow.

## Recommended deployment pattern

### Production
- custom domain: `app.repurly.org`
- branch: `main`

### Staging
- custom domain: `staging.repurly.org`
- branch: staging branch such as `staging-merged-final`

## Pre-deploy checks
1. Confirm the correct branch is selected in Render.
2. Confirm env vars are set for the target service.
3. Confirm staging uses the staging app URL:
   - `NEXT_PUBLIC_APP_URL=https://staging.repurly.org`
   - `BETTER_AUTH_URL=https://staging.repurly.org`
4. Confirm Clerk paths align with the chosen domain.
5. Confirm migrations are applied before testing invite/admin features.

## Environment essentials
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_URL`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_SCALE`

## Staging smoke test
- homepage loads
- sign-in works
- sign-up works
- settings loads
- channels loads
- reports visible in nav
- invite flow visible in settings
- company page vs personal profile visible in channels
- one low-risk publish test completes

## Promotion to production
Only promote a build after staging passes the smoke test in `docs/staging-test-checklist.md`.
