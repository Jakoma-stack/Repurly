# Repurly Daily LinkedIn Agent Beta Handoff

This patch turns Repurly into a sellable beta for the Daily LinkedIn Agent workflow.

## What was added

- `/app/daily-agent` as the new primary beta surface.
- Daily Agent intake form for pasted LinkedIn notifications, comments, analytics, profile/contact names and notes.
- AI-generated daily briefing via `src/lib/ai/daily-agent.ts`.
- Safe fallback briefing when `OPENAI_API_KEY` is not configured.
- Reply/comment/DM-style drafts generated from pasted comments and brand context.
- Who matters ranking.
- Ignore recommendations for low-intent activity.
- Simple analytics interpretation.
- Tomorrow's content idea and full draft post.
- Copy/export daily plan buttons.
- Editable action cards with approve, copied, sent manually, needs edit and ignored statuses.
- Relationship logging from Daily Agent actions.
- `/app/relationships` as a LinkedIn-native relationship tracker view.
- Session history and feedback buttons.
- Basic beta usage display.
- Jakoma-style seed/onboarding context in `scripts/seed.ts`.
- Navigation repositioned around Daily Agent, Relationships, Content, Engagement and Outreach.

## Database changes

New schema exports:

- `dailyAgentSessions`
- `dailyAgentActions`

New migration:

- `drizzle/migrations/0004_daily_linkedin_agent_beta.sql`

Run:

```bash
npm run db:migrate
```

## Validation completed

- `npm run typecheck` passed.
- `npm run lint` passed with pre-existing warnings only.

`npm run build` compiled and passed TypeScript, but could not complete page data collection in this sandbox because the build environment has no real database/Clerk services. Use the actual staging environment variables to perform the final production build.

## Beta operating model

Repurly does not scrape LinkedIn or automatically send DMs, comments, connection requests or profile actions.

The beta workflow is:

1. User pastes LinkedIn activity.
2. Repurly generates a briefing and drafts actions.
3. User edits/approves/copies/sends manually.
4. User logs selected actions to the relationship tracker.
5. Repurly stores the session and feedback.

## Not included intentionally

- OCR.
- LinkedIn official API analytics.
- Browser extension.
- Full CRM integrations.
- Team approval flows.
- Advanced scheduling.
- Multi-platform publishing expansion.
- Automated enrichment.
