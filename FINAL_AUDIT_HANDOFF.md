# Final Audit Handoff

This package is the channel-safe Repurly Growth OS handoff.

Key points:
- Public pricing uses Starter (£79/mo), Operator (£249/mo), Studio (from £699/mo).
- Customer-facing wording uses campaign/output channels, not broad direct-publish claims.
- Plan limits map to features: members, brands/offers, monthly posts, campaign/output channels, approvals and priority support.
- Safety positioning is human-in-the-loop: no scraping, no automated DMs, no fake engagement, no account-risk automation.

Production reminder:
- Run with Node 20 and npm 10.
- Configure Clerk, Stripe, Postgres, Resend, S3, Inngest and LinkedIn environment variables.
- Run npm ci, npm run typecheck, npm run lint, npm run build, and npm run commercial:check before production.
