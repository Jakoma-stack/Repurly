# Final launch checklist

## Before launch

- [ ] Create production Clerk instance and configure domains
- [ ] Provision managed Postgres and run migrations
- [ ] Create Stripe products and prices, then set env vars
- [ ] Configure Stripe webhook endpoint
- [ ] Verify Resend sending domain
- [ ] Provision S3/R2 bucket and set CORS for browser uploads
- [ ] Create LinkedIn developer app and set redirect URI
- [ ] Configure Inngest app URL and signing key
- [ ] Set TOKEN_ENCRYPTION_SECRET to a real 32-byte secret
- [ ] Add Sentry and product analytics

## Before first customer

- [ ] Run one billing checkout in live mode
- [ ] Run one billing portal session in live mode
- [ ] Connect one LinkedIn profile
- [ ] Test one page connection
- [ ] Publish one text, image, multi-image, and video post
- [ ] Verify asset uploads and retries
- [ ] Verify welcome and invite emails
- [ ] Verify paused / failed publish alerts

## After launch

- [ ] Add analytics pages
- [ ] Add usage quotas per plan
- [ ] Add approval rules per workspace
- [ ] Add activity/audit views
- [ ] Add customer help center content
