# Final Enterprise-Ready Audit Notes — Repurly

Status: ready for internal use and paid founder pilots; not yet recommended for broad self-serve launch until live integrations and billing are tested.

## Positioning

Repurly is positioned as a LinkedIn-led Growth OS for human-approved campaign workflows, output-channel adaptation, approval management, CTA tracking and lead notes.

## Commercial ladder

- Starter: £79/month.
- Operator: £249/month.
- Studio: from £699/month.
- Founder Pilot: from £950 one-off.
- Implementation/done-with-you operations: sold separately.

## Feature/plan mapping

- Starter: 1 member, 1 brand/offer, 60 monthly posts/drafts, 2 campaign/output channels, no approval workflows.
- Operator: 3 members, 4 brands/offers, 300 monthly posts/drafts, 6 campaign/output channels, approval workflows.
- Studio: 15 members, 10 brands/offers, high-volume drafts, 30 campaign/output channels, approvals and priority support.

## Risk posture

- Human-in-the-loop positioning is explicit.
- No scraping, automated DMs or fake engagement claims.
- Public wording uses campaign/output channels rather than promising universal direct publishing.
- Terms and Privacy routes have been added to the marketing app for credibility. They are early-stage baselines and should be legally reviewed before broad public launch.

## Required before broad launch

- Run npm ci, typecheck, lint and build using Node 20 + npm 10.
- Configure Clerk, Stripe, database, webhook secrets and production URL.
- Test Stripe checkout, webhooks, plan changes, limits, cancellation and portal access.
- Test LinkedIn workflow and any enabled third-party integration with real provider credentials.
- Replace support@repurly.com with the final support/privacy inbox if needed.
