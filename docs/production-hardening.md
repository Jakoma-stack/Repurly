# Production Hardening Checklist

Use this before a real customer launch.

## Infrastructure

- Managed Postgres with backups enabled
- Managed object storage for all media and generated assets
- Separate preview and production environments
- Secrets managed in deployment platform, never committed
- Inngest production environment configured

## App security

- Clerk production instance configured
- Production callback domains configured for all providers
- Rate limiting enabled on auth and integration endpoints
- CSRF strategy reviewed for any non-idempotent form submissions
- Token encryption secret rotated and stored securely
- Audit events added for integration connect/disconnect/publish failures

## Billing and email

- Stripe live mode configured
- Live products/prices created and documented
- Billing portal enabled
- Stripe webhooks verified in production
- Resend domain verified
- Welcome/invite/reset emails tested with real inboxes

## Platform integrations

- LinkedIn app approved and scopes verified
- X developer app and scopes verified
- Meta app reviewed for Facebook / Instagram scopes
- Threads API access reviewed
- Google OAuth configured for YouTube
- TikTok app reviewed for content publishing access
- End-to-end publish tests completed for each enabled platform

## Operations

- Error tracking enabled
- Workflow run alerts enabled
- Publish failure alerts enabled
- Daily backup verification in place
- Admin-only support tooling available for reconnect and retry
