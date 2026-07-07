# LinkedIn Analytics Import Update

This build adds first-class LinkedIn analytics export support to the Repurly Daily LinkedIn Opportunity Desk.

## Added

- Daily Agent upload field for LinkedIn analytics exports.
- Accepted file types: `.csv`, `.xlsx`, `.xls`.
- Server-side analytics parser at `src/lib/analytics/linkedin-import.ts`.
- Flexible metric detection for impressions/views, reactions, comments, reposts/shares, clicks, engagement, followers and profile views.
- Audience signal detection for seniority, decision-maker language, healthcare/health and care, IT services, technology and consulting.
- Top-row/post ranking from imported post analytics.
- Imported analytics summary injected into the Daily Agent AI prompt and fallback analytics review.
- Imported analytics summary displayed on generated Daily Agent sessions.
- `analytics_import_json` stored on `daily_agent_sessions`.
- Migration: `0005_linkedin_analytics_import.sql`.

## Product behaviour

Repurly still avoids risky LinkedIn scraping and automated account actions. Users can now upload analytics exports while continuing to paste comments, notifications, profile signals and screenshot text manually.

## Notes

- OCR is still intentionally later.
- LinkedIn API analytics sync is still later.
- The parser is flexible because LinkedIn export column names can vary by export type and date range.
- Maximum beta upload size defaults to 8MB and can be changed with `LINKEDIN_ANALYTICS_IMPORT_MAX_BYTES`.
