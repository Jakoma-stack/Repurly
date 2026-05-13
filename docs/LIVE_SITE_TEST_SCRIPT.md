# Repurly live-site test script

Use this before inviting any real customer into the product. Run it on the live site with your own email, your own payment card, and your own LinkedIn account first.

## Launch gates

Do not onboard a real customer until all seven gates are green:

1. Pricing is consistent everywhere: Starter, Operator, Studio.
2. Starter and Operator checkout work in live Stripe mode.
3. Stripe webhooks unlock the workspace after payment.
4. LinkedIn-led content workflow works end to end.
5. Failed publish and reconnect paths are understandable.
6. A second-user tenant isolation test passes.
7. Terms, privacy, support contact, and refund/cancellation wording are live.

## Test 1 — Public site

Pass criteria:

- Homepage loads.
- Pricing shows Starter at £79/mo.
- Pricing shows Operator at £249/mo.
- Pricing shows Studio from £699/mo.
- Start Starter goes to sign-up with `plan=core`.
- Start Operator goes to sign-up with `plan=growth`.
- Growth OS page works.
- Sign in works.
- Terms page works.
- Privacy page works.

Fail criteria:

- Old plan names or prices appear.
- Buttons go nowhere.
- Marketing claims scraping, automated DMs, fake engagement, or guaranteed leads.
- Marketing claims features that are not live.

## Test 2 — Sign-up and checkout

Create a brand new user.

Pass criteria:

- User can sign up.
- User reaches billing.
- User selects Starter or Operator.
- Stripe Checkout opens.
- Payment completes.
- Stripe redirects back to Repurly.
- Workspace becomes unlocked.
- Billing page shows active subscription.

Fail criteria:

- User gets stuck after sign-up.
- Checkout is unavailable.
- Payment succeeds but app remains locked.
- Stripe webhook does not update workspace.

## Test 3 — Billing portal

Pass criteria:

- Billing portal opens for the customer.
- Customer can update payment method.
- Customer can cancel if cancellation is enabled.

## Test 4 — Growth OS workflow

Pass criteria:

- `/app/growth-os` loads for an authenticated user.
- Internal portfolio offers are visible.
- Human-in-the-loop safety wording is visible.
- The page does not claim scraping, automated DMs, or fake engagement.

## Test 5 — Founder Pilot workflow

Pass criteria:

- Founder Pilot offer page/doc is accurate.
- Onboarding form exists if payment link is live.
- Customer receives setup instructions after payment.

## Test 6 — LinkedIn-led publishing workflow

Pass criteria:

- User can connect the intended LinkedIn destination.
- User can confirm the target.
- User can draft, approve, schedule, and review a post.
- Recovery messaging is clear if publishing fails.

## Test 7 — Human-in-the-loop safety

Pass criteria:

- No page claims automatic LinkedIn DMs.
- No page claims profile scraping.
- No page claims fake engagement.
- No page implies guaranteed leads.
