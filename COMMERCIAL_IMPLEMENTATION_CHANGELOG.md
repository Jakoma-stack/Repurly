# Commercial implementation changelog

Date: 2026-04-28

This pack implements the commercial-readiness changes requested after review.

## Implemented

- Aligned marketing pricing around Core, Growth, and Scale.
- Set Starter to £79/mo.
- Set Operator to £249/mo.
- Set Scale to Custom/manual sales.
- Removed legacy Solo, Team, and Agency plan names from customer-facing pricing surfaces.
- Removed legacy low pricing from the checked commercial docs.
- Updated the shared billing catalog so pricing has one source of truth.
- Updated billing page cards to use the shared catalog.
- Added billing portal access link on the billing page.
- Kept legacy query aliases (`solo`, `team`, `agency`) supported internally so old links do not break.
- Updated `formatPlanLabel` to display Core, Growth, and Scale.
- Updated unpaid workspace banner to match the Core/Growth/Scale commercial posture.
- Tightened `/api/health` to check production-critical env vars for live testing.
- Added recommended-env reporting for optional but important hardening variables.
- Added `LINKEDIN_API_VERSION` to env parsing and health checks.
- Updated the commercial readiness preflight script.
- Added stale pricing/copy detection to the commercial readiness preflight script.
- Added `docs/LIVE_SITE_TEST_SCRIPT.md`.
- Updated launch checklist to prioritise text-only LinkedIn publishing first.
- Updated E2E docs and homepage smoke tests for the new pricing story.
- Updated environment reference.
- Updated owner readiness guide pricing guidance.
- Updated README start guide with the monetisation posture.

## Intentional launch scope

The safe first paid customer path is LinkedIn text publishing:

draft -> approval -> schedule -> publish -> activity/recovery

Do not promise broad all-channel scheduling, automated social inbox, deep analytics, lead scraping, or media publishing until those workflows pass live testing.

## Verification performed

- Ran `scripts/commercial-readiness-check.mjs` with dummy production-style env values.
- Confirmed commercial preflight passes.
- Confirmed stale customer-facing plan names/prices no longer appear in the checked commercial files.

## Not completed in this environment

`npm ci`, full TypeScript check, lint, and production build could not be completed here because package installation exceeded the available execution window. Run this immediately after applying the zip:

```bash
npm ci
npm run commercial:verify
```
