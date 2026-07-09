# Daily Agent Beta Implementation

This build adds the sellable Repurly beta wedge: a manual-input, human-approved Daily LinkedIn Agent.

## Completed beta tasks

1. Added `daily_agent_sessions`, `daily_agent_actions` and `post_analytics_snapshots` to the Drizzle schema.
2. Added migration `0004_daily_agent_beta.sql`.
3. Added `/app/daily-agent` with daily intake, briefing output and action queue.
4. Added `generateDailyAgentBriefing()` in `src/lib/ai/daily-agent.ts` with OpenAI support and a deterministic fallback.
5. Added action statuses: `draft`, `approved`, `copied`, `sent_manually`, `logged`, `ignored`, `needs_edit`.
6. Connected Daily Agent actions to the existing lead pipeline as the beta relationship tracker.
7. Added `/app/relationships` as a LinkedIn-native relationship tracker view.
8. Added manual analytics capture and interpretation inside the Daily Agent session.
9. Added tomorrow's content idea generation as a saved Daily Agent action.
10. Reordered navigation around the beta: Daily Agent, Relationships, Content, Engagement, Outreach, Settings.

## Beta operating principle

Repurly drafts. The user approves. The user posts/sends manually. Repurly logs and learns.

## Notes

- This beta intentionally avoids LinkedIn scraping, auto-comments, auto-DMs and auto-connection requests.
- Screenshot/OCR support is not required for this build; users can paste extracted text or notes.
- Jakoma is included as seeded brand context when using the seed script defaults.
