# Repurly project status

## Current launch state
Repurly is now set up as a live commercial SaaS foundation for agency onboarding, billing, workspace setup, brand management, asset uploads, content drafting, schedule management, team access, analytics and ops review.

## What is shipped in this package
- public beta signup and Stripe checkout
- post-payment account activation and guided onboarding
- customer dashboard, billing portal access and workspace settings
- workspace team management with seat-aware plans
- self-serve brand creation and asset uploads
- customer content workflow with draft editing, explicit format selection, review submission and self-scheduling
- customer help page with plain-English guidance
- ops schedule review, publish retry and audit views
- Stripe webhook handling and billing sync

## Important external setup still required
- live SMTP credentials if you want automated emails turned on
- live LinkedIn credentials per brand if you want real posting instead of dry-run mode
- production legal/support policies and your final support process

## Recommended launch mode
Managed commercial SaaS with clear customer self-serve paths for onboarding, billing, drafting and scheduling, while keeping ops available for review, retries and operational oversight.


## Premium content studio additions
- visual content calendar and draft cards
- bulk regenerate and bulk reschedule
- campaign templates and posting strategies
- approval comments and change requests
- asset tagging with smart suggestions
- campaign/format/timing analytics

## Launch hardening added in this patch
- fixed the customer content calendar rendering bug
- exact-time-aware LinkedIn posting via cron-friendly due-post processing
- LinkedIn brand credential fallback from the SQLite brands table when JSON config is stale
