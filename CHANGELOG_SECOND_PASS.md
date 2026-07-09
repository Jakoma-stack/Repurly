# Repurly second-pass fixes

This pass addresses the remaining LinkedIn/connectivity polish gaps raised after the first round of testing fixes.

## Included
- Fixed LinkedIn callback to land on `Channels` with a post-connect onboarding state instead of the generic app home.
- Removed production localhost assumptions from app-origin resolution by preferring configured public origins or request/hosting metadata, while keeping localhost only as a non-production fallback.
- Made LinkedIn auth URL generation request-aware so redirect URIs stay tied to the active public app origin.
- Added workspace-aware post-connect onboarding in `Channels`, including discovered target review and explicit default-target confirmation.
- Added a server action to set the default LinkedIn target for the current workspace.
- Replaced demo/sample notification fallbacks with empty live-state behavior.
- Replaced demo/sample publish-activity fallback rows with an explicit "data unavailable" state.
- Replaced sample billing/reconnect fallback numbers with zeroed live-state behavior when no workspace or database is present.
- Updated `.env.example` to use production-safe placeholder origins rather than localhost defaults.

## Files changed
- `.env.example`
- `src/lib/app-url.ts`
- `src/lib/linkedin/oauth.ts`
- `src/app/api/linkedin/connect/route.ts`
- `src/app/api/linkedin/callback/route.ts`
- `src/server/actions/channels.ts`
- `src/app/app/channels/page.tsx`
- `src/server/queries/notifications.ts`
- `src/lib/usage/metering.ts`
- `src/server/queries/publish-activity.ts`
- `src/app/app/activity/page.tsx`
