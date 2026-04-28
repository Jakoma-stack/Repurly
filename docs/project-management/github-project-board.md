# GitHub project board

Use a simple Kanban-style board with these columns.

## 1. Inbox
New ideas, bugs, and requests that need triage.

## 2. This week
Work committed for the current week.

## 3. In progress
Actively being built now.

## 4. Review and QA
Ready for product review, testing, or refinement.

## 5. Ready for pilot
Completed work that can be shown to prospects or used in pilot delivery.

## 6. Blocked
Waiting on API approvals, credentials, customer input, or design decisions.

## 7. Done
Finished and accepted.

## Suggested labels

### Type
- `type:feature`
- `type:bug`
- `type:infra`
- `type:ux`
- `type:docs`

### Priority
- `p0`
- `p1`
- `p2`

### Theme
- `theme:composer`
- `theme:approvals`
- `theme:calendar`
- `theme:targets`
- `theme:reliability`
- `theme:notifications`
- `theme:billing`
- `theme:onboarding`

### Commercial
- `commercial:pilot-critical`
- `commercial:nice-to-have`
- `commercial:post-pmf`

## First-pass epics

### Epic 1 - LinkedIn launch path
- clean LinkedIn connect flow
- account and target discovery
- target selection in post flow
- publish happy path
- reconnect flow

### Epic 2 - Composer and approvals
- create or edit draft
- save draft
- assign approver
- approve, reject, or comment
- status transitions

### Epic 3 - Calendar and queue
- scheduled view
- filter by target or workspace
- reschedule
- click-through to job detail

### Epic 4 - Reliability and recovery
- job timeline
- delivery logs
- retry and requeue controls
- reconnect nudges
- actionable failures

### Epic 5 - Pilot operations
- onboarding checklist
- workspace setup flow
- notification preferences
- basic usage visibility
- support and admin shortcuts

## First 12 tickets to create

1. Hide unfinished channels from customer-facing UI
2. Replace placeholder OAuth or PKCE values in live flows
3. Remove demo workspace shortcuts from connect paths
4. Build working composer form with draft and save
5. Add target selection to create and edit flow
6. Implement approval request and response actions
7. Build basic scheduled queue or calendar page
8. Build job detail page with delivery attempts
9. Add retry and reconnect actions in job detail
10. Make dashboard read real workspace data
11. Create onboarding checklist for pilot customers
12. Create pricing sheet and pilot demo script
