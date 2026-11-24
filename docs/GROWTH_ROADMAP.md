# Repurly growth roadmap

This replaces a feature-count-driven roadmap with a gate-driven path from private pilot to a repeatable paid product. Repurly is a standalone commercial AI Marketing Director and human-approved LinkedIn opportunity desk for founders, consultants and expert-led businesses without dedicated marketing teams. The owner's portfolio is the first multi-brand customer, not a separate product or prerequisite for sales. Prioritise reusable capabilities that help both internal and external users, and do not delay paid pilots until full automation. Curated owner-pilot plans must never be exposed as a new workspace's default data.

## P0 — Prove the private workflow
- Retest historical recommendations, completed actions, malformed actions, relationship classification, workspace and brand isolation against actual authenticated pilot data.
- Keep the previously healthy staging deployment available; protect production and use a pinned, reviewed commit for any deployment.
- Verify brand settings, existing drafts and the correct destination. Never reset data on repeat setup.

Exit: unit tests, typecheck, lint, build and authenticated smoke test succeed; previously completed actions do not reappear.

## P1 — One review desk for a portfolio
- Keep brand identity, audience, voice, stage and CTA separate. Include the product itself as a marketing brand.
- Prioritise a single shared editorial queue, actual saved drafts and next actions, with safe stage-specific suggestions.
- Preserve user edits and scheduled/published records. Keep research-only products out of sales campaigns.
- Add a human-reviewed weekly digest of the few high-value actions; distinguish proposed tasks from real responses and outcomes.

Exit: each active brand has an appropriate stage and CTA; no cross-brand suppression, repeated work or accidental publishing. A private user can manage three shared editorial slots in a single review.

## P1a — AI Marketing Director, parallel with pilot preparation
- Reuse brand settings and the existing Content Studio, Daily Agent and lead pipeline.
- Provide an on-demand 30-day AI strategy, four weekly actions, evidence checks and a review-only first draft for any eligible brand. Store the plan against the brand; block stale plans and repeated draft creation. Use capped, audited AI attempts with no live market research claims.
- Next, consolidate approvals, validate first-party market evidence, create an evidence-led shared weekly briefing and connect consented enquiries to the existing pipeline.
- Keep the first external paid pilot on the critical path; recruit only when genuine onboarding and support can be offered.

Exit: a founder can prepare a relevant campaign without knowing marketing terminology, and an unrelated customer can do the same without seeing owner-specific data.

## P2 — Measurable demand and paid pilot
- Add opt-in enquiry/pilot capture, per-brand source attribution and explicit lead stages: new, qualified, interested, invited, onboarded, paid/lost.
- Separate engagement from genuine commercial interest. Never infer revenue from likes or comments.
- Validate the primary product's onboarding, identity and tenant isolation, billing, cancellation, usage limits, support, backups and deletion before offering paid access.
- Confirm pricing with real pilots; do not enable checkout or publish purchase claims until the relevant release gates pass.

Exit: real prospect conversations, at least one supported paying pilot with a verified invoice/payment, and observed value and cost to serve.

## P3 — Controlled marketing automation
- Ingest authorised first-party product release summaries and approved evidence only, not customer records, health details, financial documents or learner data.
- Use jobs with idempotency keys, retry limits, per-workspace/brand scoping, budget ceilings, audit events and a kill switch. Generate briefs, drafts, campaign suggestions and follow-up reminders.
- Publish or send only after explicit human approval and a supported, authorised destination. No LinkedIn scraping, automated connection requests, autonomous DMs or fabricated outcomes.
- Add funnel reporting using observed data, including unknown/unavailable metrics; use feedback to propose the next cycle.

Exit: an end-to-end weekly cycle is repeatable without duplicate drafts, excessive AI costs or unsupported external actions.

## P4 — Commercial hardening and controlled launch
- Measure conversion, retention, time saved, support workload and gross margin using real pilot evidence.
- Add reusable non-owner onboarding and templates; keep pilot-specific fixtures isolated.
- Validate authorised API scope, privacy notices, terms, data retention, observability, incident response and restore drills.
- Release gradually. Keep an emergency pause and rollback path. Do not switch production on the basis of CI alone.

Exit: sign-off of commercial, security, privacy and operational checks; evidence supports expanding the pilot.

## Non-goals
Do not make Repurly a generic scheduler at the expense of opportunity intelligence. Do not build autonomous LinkedIn outreach. Do not mark any portfolio product launched, paid or safe based solely on a roadmap, a test fixture or a draft. No portfolio launch should bypass its own validation gate.
