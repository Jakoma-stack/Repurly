# Product surface reference

Last reviewed: 2026-04-18

This document is the working source of truth for what Repurly can safely claim today.

## Product thesis

Repurly is currently strongest as a **premium LinkedIn-first content operations product** for:

- boutique agencies
- fractional content and social teams
- B2B marketing teams
- multi-brand workspaces that need workflow control more than channel breadth

It is not yet strongest as:

- a broad all-channel social suite
- a true social listening platform
- an enterprise attribution platform
- a creator-led LinkedIn growth tool

## What is substantively real in the product today

### 1. LinkedIn connection and publishing path

The LinkedIn stack is the most mature path in the app.

Evidence in code:
- `src/lib/linkedin/service.ts`
- `src/lib/linkedin/publisher.ts`
- `src/app/api/linkedin/*`
- `src/lib/inngest/functions.ts`

Current state:
- OAuth connection exists
- member account sync exists
- organization/page target sync exists when permissions allow
- default target selection is supported
- scheduled publishing and retry orchestration exist
- publish jobs, delivery state, and alerts are persisted

### 2. Content workflow

The composer and content workspace are meaningfully real.

Evidence in code:
- `src/app/app/content/page.tsx`
- `src/server/actions/workflow.ts`
- `src/lib/ai/*`

Current state:
- draft generation exists
- editing exists
- schedule selection exists
- target selection exists
- approval request creation exists
- approve / reject / changes-requested responses are now wired in the product surface
- approval queue review exists
- queue handoff exists

### 3. Multi-workspace / multi-brand structure

Evidence in code:
- `drizzle/schema.ts`
- `src/app/app/brands/*`
- `src/app/app/settings/*`

Current state:
- workspaces, memberships, invites, brands, and roles are modeled
- this supports real team and agency structure, not just a solo tool

### 4. Reliability / operator posture

Evidence in code:
- `src/lib/inngest/functions.ts`
- `src/server/queries/publish-activity.ts`
- `src/server/actions/publish-activity.ts`
- `src/app/app/reliability/page.tsx`

Current state:
- queue scanning exists
- idempotent publish claiming exists
- retry paths exist
- reconnect alerts exist
- operator actions for retry/requeue exist

This is one of the more differentiated parts of the product story.

## What is only partial today

### 1. Approvals are now a real single-step approval workflow, but not yet a full approval engine

Evidence in code:
- `drizzle/schema.ts` includes `approval_requests` and `approval_responses`
- the app creates approval requests
- the app now supports approve / reject / changes-requested decisions in the product surface
- posts move back to draft when rejected or sent back for changes
- approvals are still single-step and internal rather than a full external client approval portal

Safe claim:
- "approval workflow"
- "single-step reviewer responses"

Unsafe claim until completed:
- "multi-step approvals"
- "external client approval portal"
- "full approval engine"

### 2. Engagement is manual-first

Evidence in code:
- `src/app/app/engagement/page.tsx`

Safe claim:
- "manual-first LinkedIn engagement capture and AI reply drafting"

Unsafe claim until completed:
- "unified social inbox"
- "full live comment sync"
- "social listening"

### 3. Calendar is a queue view, not a full planning calendar

Evidence in code:
- `src/app/app/calendar/page.tsx`

Safe claim:
- "scheduled queue view"

Unsafe claim until completed:
- "drag-and-drop calendar planner"

### 4. AI grounding is brand-context grounding, not website crawling

Evidence in code:
- `src/lib/ai/brand-context.ts`

Safe claim:
- "brand-context and source-material grounding"

Unsafe claim until completed:
- "website crawling"
- "website grounding" if interpreted as true site ingestion

### 5. Activity detail is useful but not fully complete

Evidence in code:
- `src/server/queries/publish-activity-detail.ts`

Current state:
- detail view exists
- some ids and raw payloads are shown
- delivery logs and notification deliveries are not yet fully wired

Safe claim:
- "activity detail and retry guidance"

Unsafe claim until completed:
- "full audit console"
- "complete delivery forensics"

### 6. Billing limits are still only partly enforced

Evidence in code:
- `src/lib/billing/plans.ts`

Current state:
- plans and limits are defined
- `canConsume()` exists
- approval routing is now plan-gated in the workflow
- broader quota enforcement is still not wired through every action

Safe claim:
- "plan catalog and usage visibility"
- "approval workflow gated by plan"

Unsafe claim until completed:
- "strict quota enforcement across the app"

## Channel truth

### Primary launch-ready path
- LinkedIn

### Secondary but not core to the product story
- X
- Facebook
- Instagram

### Future-facing / adapter groundwork only
- Threads
- YouTube
- TikTok

The broader adapter layer is useful technically, but commercial positioning should still remain LinkedIn-first.

## Messaging guardrails

### Recommended language
- premium LinkedIn-first content operations
- approvals, queue control, and publish reliability
- agency and B2B workflow control
- manual-first engagement capture
- source-material and brand-context grounded drafting

### Language to avoid right now
- all-in-one social suite
- social listening
- enterprise analytics platform
- full client approval portal
- real-time omnichannel inbox
- website-grounded AI

## Highest-priority product completions

1. Finish the approval response loop
2. Finish the activity and reliability console
3. Add lightweight but credible analytics / reporting
4. Decide whether engagement stays manual-first or becomes real LinkedIn sync for owned activity
5. Enforce pricing limits inside product workflows
6. Add agency-facing external review / approval links

### 7. E2E coverage is now scaffolded

Evidence in code:
- `playwright.config.ts`
- `tests/playwright/*`
- `cypress.config.ts`
- `cypress/e2e/*`

Current state:
- Playwright and Cypress are wired into the repo
- smoke coverage exists for the public marketing surface
- deeper authenticated workflow coverage still needs fixtures or preview/staging credentials

Safe claim:
- "E2E harness wired into the repo"

Unsafe claim until completed:
- "broad end-to-end coverage across authenticated workflow surfaces"
