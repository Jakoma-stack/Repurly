# Migration notes from the legacy Repurly build

## What changed

- Flask-style server routes are replaced with Next.js App Router route handlers and server components.
- SQLite is replaced with Postgres.
- Local uploads are replaced with S3-compatible object storage.
- Ad hoc cron publishing is replaced with Inngest durable workflows and schedules.
- Manual token storage is replaced with encrypted integration records and refresh-aware token handling.
- Premium customer auth is delegated to Clerk.
- Billing is delegated to Stripe.
- Transactional email is delegated to Resend.

## Recommended migration path

1. Stand up the new infrastructure: Postgres, Clerk, Stripe, Resend, S3/R2, Inngest.
2. Map legacy workspace, brand, post, and asset records into the new schema.
3. Reconnect LinkedIn integrations via the new OAuth flow instead of reusing old tokens blindly.
4. Recreate scheduled posts as publish jobs and queue them into Inngest.
5. Cut over DNS and customer onboarding once live publishing tests pass.
