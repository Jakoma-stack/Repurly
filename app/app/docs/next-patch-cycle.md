# Next patch cycle delivered

## Goals addressed
1. Harden post-payment setup so a paying user reaches password setup and guided onboarding reliably.
2. Make the customer-facing experience feel more polished, modern, and easier to understand.

## Main changes
- stored pending checkout context before redirecting to Stripe
- added retry-based checkout confirmation
- added a fallback recovery path that can still build the customer/user/workspace handoff from pending context if Stripe confirmation is delayed
- added a checkout pending page instead of returning a payer to the public signup form
- refreshed customer/public templates to feel more premium and more guided

## Validation focus after deploy
- public signup → Stripe checkout → password setup
- password setup → getting started
- welcome email arrives if SMTP is enabled
- no successful payer is sent back to the public signup form
