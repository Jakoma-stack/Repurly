# Repurly Marketable Beta Handoff

This build repositions Repurly around the strongest commercial wedge: a Daily LinkedIn Opportunity Desk for consultants, founders and expert-led businesses.

## What changed

- Marketing homepage rewritten from content operations/scheduling to LinkedIn opportunity desk.
- Pricing repackaged as:
  - Pro Beta — £49/month
  - Assisted Beta — £250/month
  - Founder / Agency Pilot — £500+/month
- `/app` now redirects to `/app/daily-agent`.
- Navigation now prioritises:
  - Daily Agent
  - Relationships
  - Weekly Plan
  - Opportunity Settings
  - Content
  - Engagement
  - Outreach
  - Brand settings
  - Pilot Dashboard
- Added `/app/weekly-plan`.
- Added `/app/opportunity-settings`.
- Added `/app/pilot-dashboard`.
- Added opportunity settings save action using brand metadata.
- Added weekly/pilot query layer.
- Updated environment example for beta access and Daily Agent limits.

## Product positioning

Repurly is no longer positioned as a premium LinkedIn scheduler. The sellable wedge is:

> Repurly helps expert-led businesses turn daily LinkedIn activity into replies, follow-ups, relationship updates and next content ideas.

## Safe operating principle

Repurly drafts. The user approves. The user posts or sends. Repurly logs and learns.

The product should not auto-send comments, DMs, connection requests or profile actions.

## What to test next

1. Run migrations.
2. Seed Jakoma.
3. Set `ENABLE_INTERNAL_BETA_ACCESS=true` for internal testing.
4. Create three Daily Agent sessions with real Jakoma LinkedIn data.
5. Log at least three relationship actions.
6. Open Weekly Plan and confirm the next-five actions make sense.
7. Configure Opportunity Settings for Jakoma.
8. Open Pilot Dashboard and check whether usage/activation is visible.
9. Review homepage and pricing for the new marketable package.

## Commands

```bash
npm install
npm run db:migrate
npm run seed
npm run typecheck
npm run lint
npm run build
```

## Suggested internal env

```bash
ENABLE_INTERNAL_BETA_ACCESS=true
DAILY_AGENT_BETA_MONTHLY_LIMIT=40
DAILY_AGENT_ENFORCE_LIMIT=false
OPENAI_API_KEY=...
OPENAI_DAILY_AGENT_MODEL=gpt-4.1-mini
```

## Current beta status

This is suitable for private/internal Jakoma testing and for a controlled assisted beta pilot after staging validation. It is not positioned as a fully self-serve scaled SaaS yet.

## LinkedIn analytics export upload

The Daily Agent now supports optional LinkedIn analytics export uploads alongside pasted LinkedIn activity. Users can upload `.csv`, `.xlsx` or `.xls` exports from LinkedIn analytics. Repurly parses the file server-side, detects common metrics and audience/content signals, stores the parsed summary on the Daily Agent session, and feeds it into the briefing.

This improves analytics review without scraping LinkedIn or automating account actions. Screenshots/OCR, browser extension capture and official LinkedIn analytics API sync remain later-stage features.

