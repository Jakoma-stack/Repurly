Clean consolidation pass from uploaded repo base

What was reconciled
- Added workspaceInvites to drizzle/schema.ts
- Added a matching migration: drizzle/migrations/0001_workspace_invites.sql
- Added src/lib/ops/feature-flags.ts
- Added src/server/actions/settings.ts
- Added src/server/queries/settings.ts
- Added src/app/accept-invite/page.tsx
- Replaced src/app/app/settings/page.tsx with a consistent admin/settings surface
- Made Resend client lazy so build does not fail at import time when the key is missing

Why this was needed
The uploaded repo was on the older settings surface but later patch code expected workspaceInvites and richer settings actions. This pass makes schema, settings, actions, and invite flow internally consistent in one codebase.
