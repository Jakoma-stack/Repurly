# Repurly 10/10 Beta Upgrade Handoff

This package upgrades the marketable private beta towards the strongest practical 10/10 state possible without adding risky LinkedIn automation or unvalidated broad features.

## What changed

### 1. Proof Score
Added `/app/proof-score`.

This gives Repurly a practical readiness score based on:
- Daily Agent sessions in the last 7 days
- actions copied, sent or approved
- relationships logged
- no-DM / monitor discipline
- completed Opportunity Settings
- active relationship memory

This turns the beta from a feature demo into a measurable operating system.

### 2. Stronger self-serve setup
Improved `/app/opportunity-settings` with:
- per-brand setup readiness score
- clearer setup sequence
- stronger default consultant/founder template
- richer onboarding checklist
- Proof Score handoff step before treating a workspace as beta-ready

### 3. Daily Agent quality gate
Improved `/app/daily-agent` with:
- four-step quality-gate cards
- direct Proof Score access
- stronger framing around approved/manual actions
- clearer route from Daily Agent to settings, relationships and proof validation

### 4. Stronger AI guardrails
Updated the Daily Agent prompt to treat Opportunity Settings as hard constraints:
- offer
- ideal customers
- warm signals
- ignore signals
- DM policy
- content lanes
- no-go topics
- relationship rules

It also now explicitly requires DM drafts to have a natural reason. If the reason is weak, Repurly should recommend monitor/no-DM-yet instead.

### 5. Marketing reinforcement
Updated the homepage to describe the proof-led beta:
- Daily Agent
- Pilot Dashboard
- Proof Score
- retention/usage over feature sprawl

## Routes now central to the product

- `/app/daily-agent` — daily intake, reply drafts, actions, session history
- `/app/opportunity-settings` — self-serve rule setup
- `/app/relationships` — relationship memory
- `/app/weekly-plan` — weekly next-action plan
- `/app/pilot-dashboard` — 30-day pilot health
- `/app/proof-score` — beta readiness and 10/10 blocker view

## What still cannot be made 10/10 by code alone

A true 10/10 needs usage proof:
- 3+ real Daily Agent sessions per active user per week
- 5+ copied/logged actions per user per week
- zero bad DM recommendations
- completed Opportunity Settings for each active brand
- at least 3 paying beta users
- at least one user saying they would miss Repurly if it disappeared

## Deployment notes

Set on staging:

```bash
ENABLE_INTERNAL_BETA_ACCESS=true
NEXT_PUBLIC_APP_URL=https://staging.repurly.org
APP_URL=https://staging.repurly.org
DAILY_AGENT_BETA_MONTHLY_LIMIT=40
DAILY_AGENT_ENFORCE_LIMIT=false
LINKEDIN_ANALYTICS_IMPORT_MAX_BYTES=8388608
OPENAI_DAILY_AGENT_MODEL=gpt-4.1-mini
```

Then run:

```bash
npm install
npm run db:migrate
npm run typecheck
npm run lint
npm run build
```

## Next validation step

Run Jakoma through the product for 5 working days, then check `/app/proof-score`.

If the score is under 70, fix usage blockers before adding features.
If the score is 70–85, invite assisted beta users.
If the score is 85+, it is ready for a stronger private beta sales push.
