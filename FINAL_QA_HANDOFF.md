# Final QA handoff

## What was fixed in this QA pass
- Operator-control and invite admin actions now redirect correctly instead of catching Next.js redirect throws and showing false failures.
- Pricing is aligned across marketing, billing, catalog, and pricing docs.
- Team is positioned as up to 3 brands.
- Agency is positioned as up to 10 brands and can use self-serve checkout when STRIPE_PRICE_SCALE is configured.
- Billing usage now surfaces brand counts.
- Email client initialization is lazy to reduce build-time import failures.
- Docs and env example were aligned with the current pricing model and environment variable names.

## Manual staging checks still recommended
- Settings operator toggles
- Invite create / revoke / accept
- Solo / Team / Agency checkout flows
- Billing usage brand count
- LinkedIn company-page default target and publish test
