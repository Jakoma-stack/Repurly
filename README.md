# Repurly

Repurly is a premium **LinkedIn-first content operations platform** for agencies and B2B teams.

This repository contains the current working application, marketing site, billing scaffolding, and workflow surfaces for running Repurly as a focused SaaS product rather than a broad social media suite.

## Product story

Repurly wins on **workflow control and operator confidence**, not on channel count.

The strongest current workflow is:

- draft content
- choose the LinkedIn target
- request approval
- schedule into queue
- inspect job detail and recovery
- handle engagement and lightweight lead follow-up

## What is in this repository today

### Launch-ready wedge
- premium LinkedIn-first marketing site and authenticated product shell
- workspace-aware authentication and first-user workspace provisioning
- multi-brand setup for agencies and multi-brand B2B teams
- AI-assisted LinkedIn draft generation with reusable campaign defaults
- composer, target selection, approval requests, scheduling, and publish queue visibility
- engagement inbox and lightweight lead pipeline
- billing usage metering, checkout scaffolding, and portal routing
- reliability, reconnect nudges, notifications, and activity history

### Platform-extensible foundation already in code
- adapter registry for LinkedIn, X, Facebook, Instagram, Threads, YouTube, and TikTok
- live OAuth/connect paths for LinkedIn, X, Facebook, and Instagram
- publish implementations for LinkedIn, X, Facebook, and Instagram
- webhook entrypoints for Stripe, Meta, X, and YouTube
- shared publish orchestration, provider correlation IDs, delivery logs, and retry posture

### Important positioning note
Repurly is still **commercially and operationally LinkedIn-first**. The extra adapters are architecture progress, not a claim that every provider is equally launch-ready.

## Commercial posture

Repurly is deliberately positioned:

- above low-cost schedulers
- below heavyweight enterprise social suites
- strongest for premium LinkedIn workflows that need clearer control, brand separation, and operational trust

## Stack

- Next.js App Router + TypeScript
- Postgres + Drizzle ORM
- Clerk for authentication and organizations
- Stripe for subscriptions and billing state
- Resend for transactional email
- Inngest for durable workflows and retries
- S3-compatible object storage for media assets

## Local setup

```bash
npm install
npm run db:migrate
npm run seed
npm run dev
```

## Environment essentials

Required for a meaningful local run:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CORE`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_SCALE`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `LINKEDIN_SCOPE`
- `TOKEN_ENCRYPTION_SECRET`

Optional but supported in the current codebase:

- `OPENAI_API_KEY`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `ALERT_EMAIL_TO`
- `ALERT_WEBHOOK_URL`
- `S3_ENDPOINT`
- `S3_PUBLIC_BASE_URL`
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `X_REDIRECT_URI`
- `X_SCOPE`
- `META_APP_ID`
- `META_APP_SECRET`
- `FACEBOOK_REDIRECT_URI`
- `FACEBOOK_SCOPE`
- `INSTAGRAM_REDIRECT_URI`
- `INSTAGRAM_SCOPE`
- `META_WEBHOOK_VERIFY_TOKEN`
- `X_WEBHOOK_SECRET`
- `YOUTUBE_WEBHOOK_SECRET`
- `SENTRY_DSN`
- `RECONNECT_WARNING_DAYS`
- `ENABLE_LIVE_USAGE_METERING`

See `.env.example` for the full current reference.

## Repo guidance

- `docs/architecture.md` explains the current system shape.
- `docs/platform-status-matrix.md` distinguishes current launch posture from broader adapter progress.
- `docs/environment-reference.md` is the fastest way to align local setup with the actual code.
- `docs/qa/deep-dive-qa-2026-04-15.md` captures the latest repo QA review and remaining gaps.

## What this build is not pretending to be

- a broad all-network social suite
- a cheap scheduling tool
- a full CRM
- a finished social listening platform

That focus is deliberate. It lets the product feel sharper, more premium, and more commercially believable.
