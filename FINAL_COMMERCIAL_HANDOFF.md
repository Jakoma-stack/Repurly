# Final commercial handoff

This package is the current commercial candidate for Repurly.

## What it includes
- premium LinkedIn-first marketing site with consistent pricing
- signed-in product shell with reports visible in navigation
- settings surface with operator controls, support snapshot, invites, and workspace members
- channels guidance for personal profile vs company page default targets
- reporting, notifications, reliability, billing, engagement, and leads surfaces
- advanced AI drafting and campaign support already present in the application
- updated docs for deployment, pricing, product scope, and staging validation

## What still depends on live provider state
- company-page posting still depends on the connected LinkedIn account having the correct organization permissions
- billing still depends on valid Stripe price IDs and checkout configuration
- invite/admin features require the invite migration to be present in the target database

## Deployment stance
Deploy to staging first, run docs/staging-test-checklist.md, then promote to production only if the full workflow passes.
