# Jakoma Alignment and Monetisation Review

Prepared: 14 May 2026

## Control position
The action plan is the source of truth: 70% AI Governance sales, 20% Home Tech local/referral sales, 10% Repurly testing. Do not rebuild unless something is broken. Prioritise outreach, payment, delivery, proof and follow-up.

## Website package
Status: deployable with one small SEO patch and added operational link register.

Checks completed:
- Required public pages are present.
- Required Tally routes are present in the package.
- No broken internal HTML links were detected in the static package.
- 19 Stripe payment links and 91 Tally links were detected.
- Repurly public route remains interest/testing only on the Jakoma site.

Patch applied:
- Corrected the canonical URL in `fractional-governance-leader-retainer.html`.
- Added `LIVE_LINK_REGISTER.md`.

Manual owner checks still required:
- Deploy the aligned package to GitHub Pages/live hosting.
- Submit test responses through all Tally forms.
- Open each Stripe checkout and verify product, price, description, success page and cancellation flow.

## Operating suite
Status: commercially useful but the original lead tracker was not aligned to the action plan.

Patch applied:
- Added `Jakoma Lead Tracker - Aligned Monetisation.xlsx` with the required tabs: Dashboard, Leads, Sales Pipeline, Payments, Delivery, Testimonials, Content Log, Repurly Testing, Weekly Scoreboard and Lists.
- Added `LIVE_LINK_REGISTER.md`.
- Updated manifest references to the current aligned package names.

## Repurly package
Status: suitable for internal/staging testing and founder-pilot preparation, not public self-serve launch.

Patch applied:
- Added `ALIGNMENT_GATE.md`.
- Updated public marketing CTAs toward testing/founder-pilot interest rather than immediate self-serve checkout.
- Aligned the README pricing language to Founder Pilot £950 and implementation/onboarding from £1,500 where needed.

Manual owner checks still required:
- Use Node 20 and npm 10.
- Configure Clerk, Postgres, Stripe, Resend/S3/Inngest/LinkedIn and secrets.
- Run `npm ci`, `npm run commercial:check`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Test Starter/Operator plan limits, Stripe webhooks and tenant isolation before selling SaaS.

## Monetisation priority for the next 7 days
1. Deploy/verify the updated Jakoma package.
2. Send daily AI Governance outreach using checklist -> triage -> sprint ladder.
3. Send local Home Tech referral messages and route warm enquiries to £149 assessment.
4. Use the new tracker every day; no lead or reply stays outside the workbook.
5. Keep Repurly in internal testing until the gates pass.
