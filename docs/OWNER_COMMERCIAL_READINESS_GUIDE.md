# Repurly owner-only commercial readiness guide

This guide is for you, the owner. It separates:

1. **Completed in this zip** — code/documentation fixes that could be done without your private accounts.
2. **Only you can complete** — live setup steps requiring your Clerk, Stripe, LinkedIn, database, storage, domain, hosting, legal, and bank/payment access.
3. **Launch gate** — the exact checklist that must pass before customers.

## What has been completed in this zip

The following items have been implemented or added directly in this revised zip:

- Fixed the build-breaking upload filename regex in `src/app/api/uploads/presign/route.ts`.
- Changed upload object keys to use the safer pattern `workspaces/{workspaceId}/uploads/{uuid}-{filename}`.
- Removed the unsafe Stripe placeholder fallback from `src/lib/billing/stripe.ts`.
- Added lazy Stripe initialisation so the app does not silently use fake keys.
- Made `OAUTH_STATE_SECRET` required in env validation.
- Wired env validation into `next.config.ts`.
- Added `SKIP_ENV_VALIDATION=false` to `.env.example` with a warning not to use it in production.
- Added a production health endpoint at `/api/health`.
- Added plan-limit enforcement helper at `src/lib/billing/enforce-limits.ts`.
- Enforced brand limits when creating new brands.
- Enforced monthly post limits when creating manual posts and AI draft batches.
- Enforced connected-channel limits when syncing newly connected platform accounts.
- Added Stripe webhook event recording table to the Drizzle schema.
- Added migration `drizzle/migrations/0003_stripe_webhook_events.sql`.
- Added duplicate Stripe webhook handling so already-processed events are skipped.
- Added `npm run commercial:check`.
- Added `npm run commercial:verify`.
- Added this guide inside `docs/OWNER_COMMERCIAL_READINESS_GUIDE.md`.

## Important limitation

I cannot complete live customer readiness for you because that requires access to your real production accounts:

- Clerk production instance
- Stripe live account and products
- LinkedIn developer app
- Production Postgres database
- S3/R2 storage bucket
- Hosting provider
- Domain/DNS
- Email provider
- Legal documents
- Bank/payment/business details
- Real beta users

So this zip takes the code and guide as far as possible without those private owner-only actions.

---

# The only order you should follow

Do not jump ahead. Follow the phases in order.

## Phase 1 — Replace your current project with this zip

### Step 1. Create a clean folder

On your machine:

```bash
mkdir repurly-commercial
cd repurly-commercial
```

### Step 2. Unzip this package

```bash
unzip Repurly-commercial-ready-pack.zip
cd Repurly
```

### Step 3. Confirm you are in the right folder

Run:

```bash
ls
```

You should see files like:

```text
package.json
next.config.ts
src
drizzle
docs
.env.example
```

---

## Phase 2 — Create your local environment file

### Step 1. Copy the example env file

```bash
cp .env.example .env.local
```

### Step 2. Generate proper secrets

Run this twice:

```bash
openssl rand -base64 32
```

Put the first generated value into:

```text
TOKEN_ENCRYPTION_SECRET
```

Put the second generated value into:

```text
OAUTH_STATE_SECRET
```

Do not reuse the same value.

Do not use the placeholder text.

### Step 3. Keep this setting false

In `.env.local`:

```text
SKIP_ENV_VALIDATION=false
```

Only temporarily set it to `true` if you are doing a local static check before filling every secret.

Never use `SKIP_ENV_VALIDATION=true` in staging or production.

---

## Phase 3 — Install and prove the code builds

### Step 1. Install dependencies

```bash
npm ci
```

If this fails, stop and fix it before continuing.

### Step 2. Run the new commercial preflight

```bash
npm run commercial:check
```

This checks for missing commercial-readiness files and obvious missing/placeholder environment values.

### Step 3. Run the full commercial verification

```bash
npm run commercial:verify
```

This runs:

```bash
npm run commercial:check
npm run typecheck
npm run lint
npm run build
```

You must not launch unless all pass.

If it fails, fix the first error, rerun the same command, and repeat until clean.

---

## Phase 4 — Create staging before production

You need three environments:

```text
local
staging
production
```

Do not use production first.

Create staging with:

- staging database
- staging Clerk keys
- Stripe test mode
- staging storage bucket
- staging domain or subdomain
- staging env vars
- staging LinkedIn callback URL if possible

Recommended staging domain:

```text
staging.yourdomain.com
```

---

## Phase 5 — Set up production accounts

You must create or confirm these accounts.

## 5.1 Clerk

In Clerk:

1. Create a production instance.
2. Set the production domain.
3. Configure sign-in URL.
4. Configure sign-up URL.
5. Configure after-sign-in URL.
6. Configure after-sign-up URL.
7. Configure allowed redirect URLs.
8. Turn off auth methods you do not want.
9. Add production keys to hosting env vars.

Your production env values must look like live Clerk keys, not development placeholders:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## 5.2 Stripe

In Stripe live mode:

1. Create products.
2. Create monthly prices.
3. Add the price IDs to env vars.
4. Create a live webhook endpoint.
5. Add webhook signing secret to env vars.
6. Test checkout.
7. Test customer portal.
8. Test failed payment.
9. Test cancellation.
10. Test webhook replay.

Suggested commercial pricing:

```text
Core   £297/month
Growth £697/month
Scale  Custom
```

Production env vars:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_CORE=
STRIPE_PRICE_GROWTH=
STRIPE_PRICE_SCALE=  # optional if Scale is handled manually
```

## 5.3 LinkedIn

In the LinkedIn developer portal:

1. Create or use your real app.
2. Add your production callback URL.
3. Request/confirm required products and permissions.
4. Set the app logo, company, and legal links.
5. Add production env vars.

Production callback URL:

```text
https://yourdomain.com/api/linkedin/callback
```

Env vars:

```text
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://yourdomain.com/api/linkedin/callback
LINKEDIN_SCOPE=openid profile email w_member_social w_organization_social rw_organization_admin
```

## 5.4 Database

Create a production Postgres database.

Do not reuse local or staging.

You need:

- backups enabled
- point-in-time recovery if your provider supports it
- connection string stored only in hosting env vars
- no test customer data

Production env var:

```text
DATABASE_URL=
```

Then run:

```bash
npm run db:migrate
```

Confirm that this migration exists and runs:

```text
0003_stripe_webhook_events.sql
```

## 5.5 Storage

Create a private production bucket.

Use a separate bucket from staging.

Required settings:

- private bucket
- no public write access
- presigned upload only
- lifecycle cleanup for abandoned uploads
- allowed MIME types only
- file size limit

Env vars:

```text
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=
S3_PUBLIC_BASE_URL=
```

## 5.6 Email

Set up a production sending domain.

Env vars:

```text
RESEND_API_KEY=
EMAIL_FROM="Repurly <noreply@yourdomain.com>"
```

---

## Phase 6 — Deploy staging

Deploy the revised zip to staging first.

After deployment, open:

```text
https://staging.yourdomain.com/api/health
```

It should return:

```json
{
  "status": "ok"
}
```

If it returns `status: "error"`, fix the missing env/database issue before doing anything else.

---

## Phase 7 — Run the golden customer journey on staging

Use a brand-new test email address.

Complete this exact journey:

1. Sign up.
2. Create workspace.
3. Create brand.
4. Connect LinkedIn.
5. Create a text-only LinkedIn post.
6. Save draft.
7. Schedule the post.
8. Confirm the post appears in activity.
9. Publish immediately or wait for the schedule.
10. Confirm success/failure is shown clearly.
11. Open billing.
12. Start checkout in Stripe test mode.
13. Complete checkout.
14. Confirm workspace plan updates.
15. Open customer portal.
16. Cancel subscription.
17. Confirm plan downgrades or cancellation state is reflected.

If any step fails, do not launch.

---

## Phase 8 — Run tenant isolation tests manually

Create two users:

```text
owner-a@example.com
owner-b@example.com
```

Create two workspaces:

```text
Workspace A
Workspace B
```

Now try to break it.

User A must not be able to:

- view Workspace B posts
- edit Workspace B brands
- upload into Workspace B
- approve Workspace B content
- retry Workspace B publish jobs
- delete Workspace B publish jobs
- connect LinkedIn to Workspace B
- read Workspace B activity detail pages
- change Workspace B notification settings
- invite users to Workspace B

Use browser devtools or direct URLs if you can.

Any cross-workspace access is a launch blocker.

---

## Phase 9 — Keep the product LinkedIn-first

Until the other provider adapters are fully tested, market the product as:

```text
LinkedIn-first content repurposing, approval, and scheduling for B2B founders and small teams.
```

Do not claim full production support for:

- Threads
- YouTube
- TikTok
- X media/video
- any platform you have not personally published real content through

It is commercially safer to sell one reliable workflow than six half-finished workflows.

---

## Phase 10 — Prepare legal/compliance documents

You need these before paid customers:

- Privacy Policy
- Terms of Service
- Cookie Policy
- Data Processing Agreement
- Sub-processor list
- Refund/cancellation policy
- Security page
- Account deletion process
- Data deletion process
- LinkedIn disconnection process

Your sub-processor list should include the services you actually use, for example:

- Clerk
- Stripe
- hosting provider
- database provider
- S3/R2 storage provider
- Resend or email provider
- Inngest
- Sentry if used
- OpenAI or AI provider if used
- LinkedIn/Microsoft

---

## Phase 11 — Production deployment

Only after staging passes:

1. Create production environment in your host.
2. Add production env vars.
3. Confirm `SKIP_ENV_VALIDATION=false`.
4. Run migrations.
5. Deploy.
6. Open `/api/health`.
7. Confirm status is `ok`.
8. Run a fresh signup.
9. Run the golden journey again.
10. Confirm Stripe live checkout works with a real low-value transaction or Stripe-approved live test path.

---

## Phase 12 — Closed beta

Do not do a public launch first.

Choose 3 to 5 beta users.

Ideal beta users:

- B2B founder
- consultant
- small agency owner
- LinkedIn-heavy operator
- someone already posting manually

Give them a clear beta offer:

```text
Limited founder pilot from £950 for the first proof customers, then standard guided pilot/onboarding from £1,500 in exchange for a tightly supported onboarding and feedback loop.
Then £297/month or £697/month depending on usage if they keep using it.
```

Track:

- signups
- first successful LinkedIn connection
- first generated post
- first scheduled post
- first published post
- failed publish rate
- support questions
- upgrade intent

Your first success target:

```text
A beta user signs up and schedules or publishes a LinkedIn post within 15 minutes without your help.
```

---

# Final launch gate

Do not launch publicly until every item below is true.

## Code

- `npm ci` passes
- `npm run commercial:verify` passes
- database migrations run cleanly
- `/api/health` returns `ok`
- no placeholder env vars
- `SKIP_ENV_VALIDATION=false`

## Security

- tenant isolation manually tested
- upload permissions manually tested
- OAuth state cannot be obviously tampered with
- LinkedIn tokens can be disconnected/deleted
- Stripe webhook duplicates do not double-apply billing changes
- production secrets are only in the host secret manager

## Product

- LinkedIn connection works
- text post publishing works
- scheduling works
- failed publish is visible
- retry flow works
- unfinished platforms are not sold as live

## Billing

- checkout works
- portal works
- cancellation works
- failed payment has a process
- plan limits are enforced server-side

## Operations

- database backups enabled
- error monitoring enabled
- support email live
- legal pages published
- sub-processor list published
- beta feedback process ready

---

# My practical recommendation

Launch sequence:

```text
1. Make this revised zip build locally.
2. Deploy to staging.
3. Run the golden journey.
4. Fix every failure.
5. Deploy to production privately.
6. Add 3 beta users.
7. Watch them use it.
8. Charge only after the LinkedIn workflow works reliably.
9. Launch publicly after real beta success.
```

Do not add more features yet.

The commercial core is:

```text
Brand voice -> LinkedIn draft -> approval/edit -> schedule -> publish -> billing
```

Make that boringly reliable first.
