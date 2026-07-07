# Repurly Daily Reply Operating System handoff

This patch turns the Daily Agent beta into a stronger reply/relationship operating system for the Jakoma workflow.

## What changed

- Rebuilt `src/lib/ai/daily-agent.ts` around safe LinkedIn reply operations.
- Added Jakoma-specific positioning, scoring and content guardrails:
  - AI Governance, Data Assurance, Safe AI Adoption.
  - Available vs governed.
  - Policy is not proof.
  - Evidence before assurance.
  - Copilot/informal AI use, data exposure, controls, audit trail and accountability.
- Added relationship-specific rules for Anthony Tabbiruka, Rob MacPhee, Juan Pedro Marquez Castorina, Mostafa El Baroudy, Surya S, Ricardo J Flores, Thomas List, Promise Tembe, Judith Cousineau, 11Protocol and other warm commenters.
- Added no-over-DM logic through explicit recommended channels:
  - public reply
  - DM
  - connection note
  - review profile
  - monitor
  - no DM yet
  - meeting prep
  - tracker update
  - content
- Added fallback-mode visibility so users know when OpenAI is not configured.
- Added proper monthly usage counting and optional server-side enforcement.
- Added internal beta billing bypass via `ENABLE_INTERNAL_BETA_ACCESS=true`.
- Cleaned the duplicate Daily Agent migration.
- Added `generation_mode` and `recommended_channel` columns.
- Updated Jakoma seed data so the selected brand no longer points to Repurly/LinkedIn pipeline content.
- Simplified primary navigation around the Daily Agent workflow.
- Updated relationship stages to match relationship intelligence rather than a generic sales pipeline.

## Required deployment steps

1. Set environment variables for internal testing:

```bash
ENABLE_INTERNAL_BETA_ACCESS=true
DAILY_AGENT_BETA_MONTHLY_LIMIT=40
```

2. Optional but recommended for higher-quality briefings:

```bash
OPENAI_API_KEY=...
OPENAI_DAILY_AGENT_MODEL=gpt-4.1-mini
```

3. Run the migration:

```bash
npm run db:migrate
```

4. Seed the Jakoma workspace if needed:

```bash
CLERK_USER_ID=<your-clerk-user-id> npm run seed
```

5. Run checks in the real app environment:

```bash
npm run typecheck
npm run lint
npm run build
```

The sandbox did not include `node_modules`, so this handoff includes a TypeScript transpile check rather than a full project typecheck/build.

## Jakoma acceptance test

Paste a test Daily Agent session containing:

- Anthony Tabbiruka as partner/referral prep.
- Rob MacPhee as warm NIAS/data-driven care follow-up.
- Juan Pedro Marquez Castorina as high-value Copilot governance / no DM yet.
- Mostafa El Baroudy as review only.
- Surya S / Ricardo J Flores / Thomas List as monitor only.
- Judith Cousineau or 11Protocol comments about policy, evidence or Copilot.
- Latest analytics showing senior/director/CXO audience quality.

Expected output:

- Anthony appears high priority with meeting/partner prep.
- Rob appears high priority but light follow-up only.
- Juan appears high priority with public engagement / no DM yet.
- Mostafa appears review profile only.
- Profile views alone are not turned into DMs.
- Meaningful governance/evidence comments get public reply drafts.
- Tomorrow's post is about AI governance/readiness/evidence, not Repurly or LinkedIn pipeline.

## Still not included

The product still intentionally does not include:

- LinkedIn scraping.
- Automatic comments.
- Automatic DMs.
- Automatic connection requests.
- OCR.
- Official LinkedIn analytics sync.
- Browser extension.
- Full CRM integrations.
- Automated enrichment.
