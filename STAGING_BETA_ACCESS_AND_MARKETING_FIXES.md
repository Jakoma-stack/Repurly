# Staging beta access and marketing fixes

This patch fixes the two issues found on staging after the marketable beta deploy.

## Product access

- Staging private beta access now bypasses the payment wall when either:
  - `ENABLE_INTERNAL_BETA_ACCESS=true`, or
  - `NEXT_PUBLIC_APP_URL` / `APP_URL` contains `staging.repurly.org`, or
  - the app is running on an `.onrender.com` staging URL.
- Production domains still require billing unless `ENABLE_INTERNAL_BETA_ACCESS=true` is explicitly set.
- The unpaid navigation wording now says beta access is not enabled, rather than pushing users straight into a payment-required message.

Recommended Render staging env:

```bash
ENABLE_INTERNAL_BETA_ACCESS=true
NEXT_PUBLIC_APP_URL=https://staging.repurly.org
APP_URL=https://staging.repurly.org
```

## Marketing packaging

- Assisted Beta pricing card is now readable and highlighted without washed-out text.
- Added explicit LinkedIn analytics export upload language.
- Added a good-fit qualifier: Repurly is not for scraping, mass automation or cold DM campaigns.
- CTA wording now uses clearer private beta language.
- Pricing buttons now use:
  - Join private beta
  - Apply for Assisted Beta
  - Discuss agency pilot

## Files changed

- `src/lib/billing/workspace-billing.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/marketing/hero.tsx`
- `src/app/(marketing)/page.tsx`
- `src/lib/billing/catalog.ts`
