This patch addresses two issues:

1. Multi-brand AI isolation
- Composer now prefers an explicit brandId query parameter.
- Saved campaign state only auto-applies when it matches the selected brand.
- Default planner brief now derives from the selected brand instead of a hard-coded Repurly brief.
- AI prompt includes explicit instructions not to mix workspace brands.

2. Billing plan aliases and pricing consistency
- Checkout now accepts both internal plan keys (core/growth/scale) and friendly names (solo/team/agency).
- Billing and marketing CTAs use friendly plan names.
- Agency supports self-serve checkout if STRIPE_PRICE_SCALE is configured.
- Usage now includes brand counts, and Team / Agency brand limits are surfaced more clearly.
