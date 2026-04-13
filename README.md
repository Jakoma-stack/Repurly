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

## Included in this build

- premium LinkedIn-first marketing site and authenticated product shell
- workspace-aware authentication and first-user workspace provisioning
- multi-brand setup for agencies and multi-brand B2B teams
- AI-assisted LinkedIn draft generation with reusable campaign defaults
- composer, target selection, approval requests, scheduling, and publish queue visibility
- engagement inbox and lightweight lead pipeline
- billing usage metering, checkout scaffolding, and portal routing
- reliability, reconnect nudges, notifications, and activity history

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

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_SCALE`
- `NEXT_PUBLIC_APP_URL`

## What this build is not pretending to be

- a broad all-network social suite
- a cheap scheduling tool
- a full CRM
- a finished social listening platform

That focus is deliberate. It lets the product feel sharper, more premium, and more commercially believable.
