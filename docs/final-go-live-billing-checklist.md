# Final go-live billing checklist

## What this build adds

- Runtime-safe SQLite schema migration on app requests and billing operations.
- Customer billing page at `/account/billing`.
- Stripe customer portal launch from the customer billing page.
- Manual Stripe sync actions for both customers and ops.
- Safer ops billing page behavior on upgraded databases.

## Render environment variables

Set these in the live `repurly-app` service:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` (optional but recommended)
- `BILLING_PORTAL_RETURN_PATH=/account/billing`
- `WORKSPACE_BILLING_REQUIRED=false` while monitoring first live signups

## Stripe dashboard setup

1. Confirm the webhook endpoint is `https://app.repurly.org/stripe/webhook`.
2. Confirm it listens to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
3. Enable a Billing Portal configuration in Stripe and copy its configuration ID if you want to lock down which self-service actions customers can take.

## Recommended live rollout

1. Deploy this build.
2. Open Render shell and run `python scripts/init_db.py` once against the persistent database.
3. Test `/ops/billing`.
4. Test one live checkout with a 100 percent promotion code.
5. Test the customer portal from `/account/billing`.
6. Test the ops sync button and the customer sync button.
7. Only then switch `WORKSPACE_BILLING_REQUIRED=true`.

## Go-live URLs

- Marketing site: `https://repurly.org`
- Workspace sign-up: `https://app.repurly.org/start`
- Customer login: `https://app.repurly.org/login`
- Customer dashboard: `https://app.repurly.org/dashboard`
- Customer billing: `https://app.repurly.org/account/billing`
- Ops billing: `https://app.repurly.org/ops/billing`
