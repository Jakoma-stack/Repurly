# Phase 2 workplan

## What this build adds
- Stripe-gated workspace access
- customer billing page
- checkout sessions tied to user and workspace metadata
- subscription status shown inside the customer dashboard and ops billing view

## What you still need to do outside the code
1. Add real Stripe env vars in Render:
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - STRIPE_PUBLISHABLE_KEY
   - STRIPE_PRICE_STARTER
   - STRIPE_PRICE_GROWTH
   - STRIPE_PRICE_PRO
2. Set `WORKSPACE_BILLING_REQUIRED=true` only after Stripe checkout and webhook handling are verified.
3. In Stripe, make sure your checkout products/prices match starter / growth / pro.
4. Test this live flow end to end:
   - invite user
   - activate account
   - log in
   - land on billing gate
   - complete checkout
   - confirm webhook writes an active subscription
   - refresh and confirm dashboard unlocks
5. Decide your cancellation and refund policy.
6. Decide when to add a customer billing portal and transactional billing emails.

## Recommended next phase
Phase 3 should add:
- customer billing portal / manage subscription
- multi-user workspace seats
- role-based permissions inside workspaces
- Stripe-based trial handling and failed-payment comms
