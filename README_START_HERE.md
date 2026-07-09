# Repurly — Marketable Beta Start Here

Repurly is now packaged as a Daily LinkedIn Opportunity Desk for consultants, founders and expert-led businesses.

## Core promise

Paste what happened on LinkedIn. Repurly tells you:

- who matters
- what to reply
- what to ignore
- who to follow up
- what to log
- what to post next

## Operating principle

Repurly drafts. The user approves. The user posts or sends. Repurly logs and learns.

Do not position Repurly as a LinkedIn automation tool. It should not auto-send comments, DMs, connection requests or profile actions.

## Main app flow

- `/app/daily-agent` — daily intake and action queue
- `/app/relationships` — relationship tracker and follow-up reminders
- `/app/weekly-plan` — weekly next-action plan
- `/app/opportunity-settings` — offer, audience, warm-signal and no-DM settings
- `/app/pilot-dashboard` — assisted beta usage/activation view
- `/app/content` — secondary content studio
- `/app/engagement` — captured comments/reply drafts
- `/app/outreach-copilot` — manual outreach drafts

`/app` redirects to `/app/daily-agent` because the Daily Agent is now the product centre.

## Beta pricing

- Pro Beta — £49/month
- Assisted Beta — £250/month
- Founder / Agency Pilot — £500+/month

See `pricing_overview.md` and `REPURLY_MARKETABLE_BETA_HANDOFF.md`.

## Local/staging setup

```bash
npm install
npm run db:migrate
npm run seed
npm run typecheck
npm run lint
npm run build
```

For internal Jakoma testing:

```bash
ENABLE_INTERNAL_BETA_ACCESS=true
DAILY_AGENT_BETA_MONTHLY_LIMIT=40
DAILY_AGENT_ENFORCE_LIMIT=false
OPENAI_API_KEY=...
OPENAI_DAILY_AGENT_MODEL=gpt-4.1-mini
```

## Immediate validation path

1. Seed Jakoma.
2. Open Daily Agent.
3. Paste real LinkedIn notifications, comments, analytics and names.
4. Confirm output prioritises AI governance/data assurance and does not pitch from weak signals.
5. Log at least three relationships.
6. Open Weekly Plan.
7. Configure Opportunity Settings.
8. Open Pilot Dashboard and check activation metrics.

## LinkedIn analytics export upload

The Daily Agent now supports optional LinkedIn analytics export uploads alongside pasted LinkedIn activity. Users can upload `.csv`, `.xlsx` or `.xls` exports from LinkedIn analytics. Repurly parses the file server-side, detects common metrics and audience/content signals, stores the parsed summary on the Daily Agent session, and feeds it into the briefing.

This improves analytics review without scraping LinkedIn or automating account actions. Screenshots/OCR, browser extension capture and official LinkedIn analytics API sync remain later-stage features.


## 10/10 Beta additions

This build includes the 10/10 beta improvement pass:

- `/app/proof-score` for beta readiness and validation scoring
- stronger `/app/opportunity-settings` self-serve setup
- Daily Agent quality-gate cards
- stricter AI guardrails around no-DM discipline and brand rules
- proof-led beta messaging on the homepage

Use `/app/proof-score` after 3-5 real Daily Agent sessions to decide whether to invite more beta users.
