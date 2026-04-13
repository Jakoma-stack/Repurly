# Repurly current commercial release

## Release intent
This package is the current commercial candidate for staging and pre-production testing.

## Commercial standard in this release
- buyer-facing marketing site with consistent premium positioning
- consistent pricing across docs, marketing, and billing
- reports visible in navigation
- settings surface includes operator controls, support snapshot, invites, and members
- channels flow clarifies personal profile vs company page default targets
- docs updated to reflect the current product state and deployment flow

## Known real-world dependencies
- company-page publishing still depends on the connected LinkedIn account having the correct organization permissions
- billing still depends on valid Stripe price IDs and checkout configuration
- invite/admin features require the workspace invite migration to be applied

## Recommended validation
Use docs/staging-test-checklist.md before promoting any build to production.
