# Workspace sessions, verified webhooks, and notifications center

This build adds the next layer of production maturity in three areas:

## 1. Workspace-aware product session

Repurly now resolves an active workspace session for the signed-in user and carries that through the protected app shell.

What this changes:
- the app header reflects the active workspace, role, and slug
- channels and notifications are read in the context of the active workspace
- a dedicated route exists to switch workspace safely: `POST /api/workspaces/select`

Implementation files:
- `src/lib/auth/workspace.ts`
- `src/app/api/workspaces/select/route.ts`
- `src/components/layout/app-shell.tsx`
- `src/app/app/layout.tsx`

## 2. Verified provider webhooks

Webhook intake routes now verify signatures/tokens before accepting callback payloads.

Covered routes:
- `src/app/api/webhooks/meta/route.ts`
- `src/app/api/webhooks/x/route.ts`
- `src/app/api/webhooks/youtube/route.ts`

Verification helpers:
- `src/lib/webhooks/signatures.ts`

Environment variables used:
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `X_WEBHOOK_SECRET`
- `YOUTUBE_WEBHOOK_SECRET`

## 3. Customer-facing notifications center

Repurly now includes a dedicated in-app notifications surface so reconnect warnings, provider state changes, and alert events are visible outside the ops/reliability screen.

Files:
- `src/app/app/notifications/page.tsx`
- `src/components/notifications/notifications-center.tsx`
- `src/server/queries/notifications.ts`

The notifications center blends:
- open alert events
- reconnect nudges
- integration health signals

## Recommended next step

The strongest next hardening pass after this build is:
- notification preferences by workspace member
- email/in-app delivery channels per notification type
- acknowledgement and snooze actions
- fully verified provider callback payload mapping into publish jobs
