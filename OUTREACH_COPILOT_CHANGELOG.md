# Outreach Copilot Edition changelog

Added a new Repurly Outreach Copilot feature for manual, human-approved outreach operations.

## Product additions

- New `/app/outreach-copilot` page
- New sidebar navigation item
- Manual prospect/page capture form
- Outreach fit scoring
- Daily queue based on next action date
- Draft generation for connection notes, first messages, public comments, follow-ups and referral asks
- Guardrails displayed in-product: no scraping, no auto-DMs, no fake engagement, no bulk sending
- Lead pipeline reuse through `lead_pipeline.metadata`

## New code files

- `src/lib/outreach/copilot.ts`
- `src/server/queries/outreach-copilot.ts`
- `src/server/actions/outreach-copilot.ts`
- `src/app/app/outreach-copilot/page.tsx`
- `docs/outreach-copilot.md`

## Existing code updated

- `src/components/layout/app-shell.tsx`

## Notes

This build intentionally avoids platform-risky automation. It does not scrape LinkedIn/Facebook and does not send DMs automatically. It supports the intended Repurly Managed LinkedIn Ops Pilot by creating a safer relationship queue and message drafting workflow.
