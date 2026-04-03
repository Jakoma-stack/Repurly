# Repurly v2 LinkedIn Pilot Build

Repurly is a narrow, premium product for **LinkedIn-first content operations**.

This repository is the current pilot-focused handoff: a workflow-first codebase for agencies and B2B teams that need cleaner approvals, reliable publishing, visible recovery paths, and a credible route to paid pilots without pretending to be a broad social suite.

## What this build is for

Use this build to run a narrow launch around:

- LinkedIn-first publishing
- target-aware scheduling
- approval workflow
- calendar and queue visibility
- publish job detail and recovery
- pilot-ready onboarding and operations

## Stack

- Next.js App Router + TypeScript
- Postgres + Drizzle ORM
- Clerk for authentication and organizations
- Stripe Billing for pilot billing and self-serve expansion later
- Resend for transactional email
- Inngest for durable workflows, retries, and schedules
- S3-compatible object storage for media and generated assets

## Included in this zip

- Pilot-positioned marketing site and authenticated product shell
- Shared workflow model for workspaces, brands, posts, post targets, approvals, platform accounts, assets, integrations, and billing state
- LinkedIn-first connection and publishing path
- Secondary adapter paths for X, Facebook Pages, and Instagram kept available but not centered in launch UX
- Publish activity, delivery logs, reconnect nudges, notifications, and retry controls
- Billing, upload signing, and workflow scaffolding for paid pilot delivery
- Launch docs, provider setup guides, and operating docs

## Important truth

This repo is **not** positioned as a finished broad multi-network suite.

This build is intended to support a narrow commercial wedge:

- strongest visible path: LinkedIn
- strongest buyer story: approvals, reliability, and operator visibility
- strongest commercial motion: paid pilots

Keep future-channel code in the repo, but do not let it define the launch story.

## Launch posture

Repurly should be sold as:

- LinkedIn-first content ops for agencies and B2B teams
- a premium workflow product
- a paid-pilot offer before broad self-serve SaaS expansion

Repurly should **not** currently be sold as:

- a broad social suite
- a creator growth tool
- a cheap scheduler
- a head-on Sprout replacement

## Current launch surface

- LinkedIn: hero channel and default operator path
- X / Facebook / Instagram: available as secondary/internal expansion paths
- Threads / YouTube / TikTok: kept out of the launch story

## Local development

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## Suggested deployment

- App: Vercel or another Node-compatible platform
- Database: managed Postgres
- Storage: S3 or Cloudflare R2
- Workflows: Inngest Cloud
- Billing: Stripe
- Email: Resend

## Read these first

- `docs/decision/Repurly_revised_launch_decision_memo.docx`
- `docs/decision/Repurly_revised_go_no_go_checklist.docx`
- `docs/build-decisions/OPTIMISED_BUILD_DECISION.md`
- `docs/launch-checklist.md`
- `docs/project-management/go-no-go-gates.md`
- `docs/strategy/github-repo-positioning.md`
