# Repurly

LinkedIn-first content operations platform for agencies and B2B teams.

## Positioning

Repurly is not being built as a broad social media suite. The current strategy is to launch as a **LinkedIn-first content operations product** focused on:

- approvals
- scheduling
- multi-target publishing
- publish visibility
- retries and reconnect handling
- operator confidence

The target customer is:

1. boutique agencies running LinkedIn for B2B clients
2. in-house B2B teams managing company plus executive content

## Current product thesis

The product should win on **workflow and reliability**, not on channel count.

That means the first commercial version should make these workflows excellent:

- create post
- assign for approval
- schedule
- publish
- inspect job status
- recover from failures
- reconnect accounts cleanly

## Current scope

### In scope now

- LinkedIn-first experience
- core composer flow
- approval workflow
- calendar or queue
- post targets and account management
- job detail and delivery visibility
- notifications and reconnect prompts

### Explicitly out of scope for now

- Threads
- YouTube
- TikTok
- social listening
- community inbox
- advanced analytics
- AI writing as the hero feature

## Commercial plan

This should launch first as a **pilot-ready product** that can support a concierge-backed or white-glove rollout.

The initial commercial motion is:

1. sell narrow paid pilots
2. onboard customers manually
3. use the product to deliver reliable publishing ops
4. productize only repeated pain

## Success criteria

The first stage is not “validated SaaS.” The first stage is:

- pilot-ready product
- paid pilot customers
- repeated operational pain confirmed
- willingness to pay at premium pricing

## Suggested repo structure

- `src/` application code
- `docs/strategy/` decision memos and launch framing
- `docs/execution/` near-term plan and operating docs
- `docs/project-management/` project board and launch gates
- `.github/` issue templates and PR template

## Key docs

- `docs/strategy/launch-decision-summary.md`
- `docs/execution/roadmap-30-days.md`
- `docs/execution/pricing-and-icp-notes.md`
- `docs/project-management/github-project-board.md`
- `docs/project-management/go-no-go-gates.md`

## Setup

1. Copy `.env.example` to `.env.local`
2. Fill in the required environment values
3. Install dependencies
4. Start the app locally
5. Work from the 30-day roadmap before expanding scope

## Rules for this repo

- Keep the frontend promise narrow
- Do not market unfinished channels
- Do not widen scope before pilot feedback
- Prefer workflow polish over channel breadth
- Prefer real customer proof over feature volume
