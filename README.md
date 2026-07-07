# Repurly

Repurly is a Daily LinkedIn Opportunity Desk for consultants, founders and expert-led businesses.

It helps users turn LinkedIn activity into human-approved replies, follow-ups, relationship updates and next content ideas.

## Product principle

> Repurly drafts. The user approves. The user posts or sends. Repurly logs and learns.

Repurly should avoid risky LinkedIn automation. Do not auto-send comments, DMs, connection requests or profile actions.

## Beta product surface

- Daily Agent intake and briefing
- who matters ranking
- public reply, DM draft and no-DM-yet recommendations
- ignore/monitor recommendations
- relationship tracker
- tracker update suggestions
- tomorrow’s post idea
- weekly next-action plan
- opportunity settings for each brand
- assisted beta pilot dashboard

## Positioning

Repurly is not another generic AI content generator or scheduler. The wedge is the gap between LinkedIn engagement and commercial follow-up.

Best-fit users:

- B2B consultants
- fractional leaders
- agency founders
- advisors
- coaches with high-ticket offers
- founder-led expert businesses

## Pricing package

- Pro Beta — £49/month
- Assisted Beta — £250/month
- Founder / Agency Pilot — £500+/month

## Development

```bash
npm install
npm run db:migrate
npm run seed
npm run typecheck
npm run lint
npm run build
```

## Key environment variables

```bash
DATABASE_URL=...
CLERK_USER_ID=...
ENABLE_INTERNAL_BETA_ACCESS=true
DAILY_AGENT_BETA_MONTHLY_LIMIT=40
DAILY_AGENT_ENFORCE_LIMIT=false
OPENAI_API_KEY=...
OPENAI_DAILY_AGENT_MODEL=gpt-4.1-mini
```

## LinkedIn analytics export upload

The Daily Agent now supports optional LinkedIn analytics export uploads alongside pasted LinkedIn activity. Users can upload `.csv`, `.xlsx` or `.xls` exports from LinkedIn analytics. Repurly parses the file server-side, detects common metrics and audience/content signals, stores the parsed summary on the Daily Agent session, and feeds it into the briefing.

This improves analytics review without scraping LinkedIn or automating account actions. Screenshots/OCR, browser extension capture and official LinkedIn analytics API sync remain later-stage features.

