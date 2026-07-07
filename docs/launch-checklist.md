# Final launch checklist

## Before launch

- [ ] Confirm public pricing is Core £297/mo, Growth £697/mo, Scale Custom everywhere
- [ ] Create production Clerk instance and configure domains
- [ ] Provision managed Postgres and run migrations
- [ ] Create Stripe products and live prices for Core and Growth
- [ ] Decide whether Scale uses manual invoicing or a private Stripe price
- [ ] Configure Stripe webhook endpoint
- [ ] Verify Resend sending domain
- [ ] Provision S3/R2 bucket and set CORS for browser uploads
- [ ] Create LinkedIn developer app and set redirect URI
- [ ] Configure Inngest app URL and signing key
- [ ] Set TOKEN_ENCRYPTION_SECRET to a real 32-byte secret
- [ ] Set OAUTH_STATE_SECRET to a different real 32-byte secret
- [ ] Add Sentry and product analytics
- [ ] Run `npm run commercial:verify`
- [ ] Check `/api/health` returns `status: ok`

## Before first customer

- [ ] Run one Core checkout in live mode
- [ ] Run one Growth checkout in live mode
- [ ] Run one billing portal session in live mode
- [ ] Confirm Stripe webhook unlocks the workspace
- [ ] Connect one LinkedIn profile
- [ ] Test one LinkedIn company-page connection if your account has admin rights
- [ ] Publish one LinkedIn text-only post end to end
- [ ] Verify failed-publish and reconnect guidance
- [ ] Verify welcome and invite emails
- [ ] Verify paused / failed publish alerts
- [ ] Run the tenant isolation test in `docs/LIVE_SITE_TEST_SCRIPT.md`

## Do not promise yet

- [ ] Broad all-network scheduling
- [ ] Automated social inbox
- [ ] Deep analytics
- [ ] Automatic lead scraping
- [ ] Hands-off LinkedIn growth
- [ ] Image, carousel, or video publishing until each provider media upload flow has passed live testing

## After launch

- [ ] Add analytics pages
- [ ] Add usage quotas per plan
- [ ] Add richer approval rules per workspace
- [ ] Add richer activity/audit views
- [ ] Add customer help center content
