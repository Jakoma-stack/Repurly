# Repurly Deep Dive Review and Patch

## Summary

This version is commercially viable as a pilot-first LinkedIn-led Growth OS, provided it is launched with limited customers and manual onboarding before broad self-serve SaaS promotion.

## Commercial assessment

Repurly should not compete with low-cost schedulers on price. The market has cheap scheduling tools and expensive enterprise suites. Repurly's strongest wedge is a narrower revenue workflow for consultants, agencies, and B2B operators:

- campaign planning
- brand/offer context
- LinkedIn-first content drafts
- approvals and human review
- CTA and lead notes
- follow-up workflow without scraping or automated DMs

Recommended route:

1. Use internally for Jakoma.
2. Sell 3-5 Founder Pilots at £950.
3. Convert successful pilots to Operator at £249/mo.
4. Keep Studio from £699/mo application-led or assisted.

## Subscription mapping reviewed

The public plans map to internal keys as follows:

- Starter => `core`
- Operator => `growth`
- Studio => `scale`

Stripe checkout stores the internal key in metadata. The Stripe webhook resolves the Stripe price ID and updates `workspaces.plan`. The app then uses the stored plan to enforce limits.

## Patch applied

This patch strengthens subscription-to-function mapping:

1. Added boolean feature enforcement in `src/lib/billing/enforce-limits.ts`.
2. Enforced workspace member limits during invite creation and invite acceptance.
3. Enforced approval workflows so Starter cannot create approval requests.
4. Added a user-facing error for blocked approval workflows.
5. Updated static `index.html` pricing from old Core/Growth/Scale to Starter/Operator/Studio.
6. Added `docs/subscription-feature-mapping.md`.
7. Added `docs/commercial-viability-review.md`.

## Current enforced limits

| Feature | Starter | Operator | Studio |
|---|---:|---:|---:|
| Members | 1 | 3 | 15 |
| Brands/offers | 1 | 4 | 10 |
| Monthly posts/drafts | 60 | 300 | 10,000 |
| Campaign/output channels | 2 | 6 | 30 |
| Approval workflows | No | Yes | Yes |
| Priority support | No | No | Yes |

## Remaining pre-launch checks

Before taking live subscriptions:

- configure Stripe live price IDs for `STRIPE_PRICE_CORE` and `STRIPE_PRICE_GROWTH`
- decide whether `STRIPE_PRICE_SCALE` should remain unset for manual Studio sales
- test checkout success and webhook update into `workspaces.plan`
- test a Starter workspace cannot add a second member, second brand, or approval request
- test an Operator workspace can add up to 3 members, 4 brands, and approval requests
- run `npm run typecheck`, `npm run lint`, and `npm run build` using Node 20 + npm 10

## Remaining product recommendations

Add later, not before first pilots:

- hard storage enforcement at upload/write time
- clearer in-product upgrade prompts beside gated actions
- customer onboarding checklist inside the app
- pilot feedback form
- Stripe customer portal copy for cancellations/downgrades


## Channel-safe revision

This revision changes public wording from connected channels to campaign/output channels. This avoids implying every supported destination is a live direct-publish integration.

Direct publishing should be marketed only where integration setup has been approved and tested. Other destinations should be positioned as export-ready campaign outputs, briefs, scripts, captions, or manual-posting checklists.
