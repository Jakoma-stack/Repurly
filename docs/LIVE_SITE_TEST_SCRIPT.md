# Repurly live-site test script

Use this before inviting any real customer into the product. Run it on the live site with your own email, your own payment card, and your own LinkedIn account first.

## Launch gates

Do not onboard a real customer until all seven gates are green:

1. Pricing is consistent everywhere: Core, Growth, Scale.
2. Core and Growth checkout work in live Stripe mode.
3. Stripe webhooks unlock the workspace after payment.
4. LinkedIn text publishing works end to end.
5. Failed publish and reconnect paths are understandable.
6. A second-user tenant isolation test passes.
7. Terms, privacy, support contact, and refund/cancellation wording are live.

## Test 1 — Public site

Pass criteria:

- Homepage loads.
- Pricing shows Core at £297/mo.
- Pricing shows Growth at £697/mo.
- Pricing shows Scale as Custom.
- Start Core goes to sign-up with `plan=core`.
- Start Growth goes to sign-up with `plan=growth`.
- Sign in works.
- Terms page works.
- Privacy page works.

Fail criteria:

- Old plan names or low prices appear.
- Buttons go nowhere.
- Marketing claims features that are not live.

## Test 2 — Sign-up and checkout

Create a brand new user.

Pass criteria:

- User can sign up.
- User reaches billing.
- User selects Core or Growth.
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

From inside the app:

1. Open Billing.
2. Click the Stripe billing portal link.
3. Confirm portal opens.
4. Return to the app.

Pass if the user can manage billing.

## Test 4 — Workspace setup

Inside the paid/unlocked workspace:

1. Open Brands.
2. Create one brand.
3. Add website.
4. Add audience.
5. Add tone of voice.
6. Add CTA.
7. Save.

Pass if the brand appears everywhere it should.

## Test 5 — LinkedIn connection

1. Open Channels.
2. Connect LinkedIn.
3. Approve LinkedIn permissions.
4. Return to Repurly.
5. Confirm a LinkedIn target appears.
6. Set the default target.

Pass if your personal profile appears. Company pages are a bonus until you have confirmed admin rights and approved scopes.

## Test 6 — Create a text-only post

1. Open Studio.
2. Create a text-only post.
3. Choose brand.
4. Choose LinkedIn target.
5. Save draft.

Pass if the draft saves and appears in the content workflow.

## Test 7 — Approval flow

Use the owner account first.

1. Request approval.
2. Approve the post.
3. Confirm status changes to approved.
4. Repeat with reject and request-changes paths.

Pass if approval status changes correctly and no cross-workspace data appears.

## Test 8 — Schedule and publish

Use a simple text post.

1. Schedule for a few minutes from now.
2. Open Activity.
3. Confirm job appears as queued.
4. Wait for the publish attempt.
5. Refresh Activity.
6. Check LinkedIn.

Pass criteria:

- Job moves through queued, publishing, and published states.
- LinkedIn post appears.
- Activity detail stores provider result.
- No duplicate posts appear.

Fail criteria:

- Job stays queued.
- Job fails without a useful reason.
- Post appears twice.
- Post says published but is not on LinkedIn.

## Test 9 — Recovery test

1. Disconnect LinkedIn.
2. Check reconnect warning.
3. Reconnect LinkedIn.
4. Schedule another text post.
5. Confirm publishing works again.

Pass if reconnect guidance is understandable.

## Test 10 — Tenant isolation test

Create a second user with a different email.

1. Sign up as User B.
2. Pay or manually grant access.
3. Create Workspace B.
4. Create Brand B.
5. Create Post B.

Now confirm:

- User A cannot see User B brand.
- User A cannot see User B posts.
- User A cannot see User B billing.
- User A cannot see User B LinkedIn target.
- User B cannot see User A data.

This is a hard customer-readiness gate.

## First paid offer

Use this for the first three paid pilots:

- Repurly LinkedIn Operations Pilot.
- £1,500 setup.
- Then £297/month or £697/month depending on usage.
- Includes workspace setup, brand setup, LinkedIn connection, first content workflow, approval workflow, first scheduled post, and onboarding.

Do not sell all-platform scheduling, automated social inbox, advanced analytics, automatic lead scraping, or hands-off LinkedIn growth until those workflows are proven live.
