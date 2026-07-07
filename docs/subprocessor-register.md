# Repurly Subprocessor Register - Draft

Last updated: 14 May 2026

This register must be finalised before production launch.

| Provider | Purpose | Data categories | Notes |
|---|---|---|---|
| Clerk | Authentication and user management | Account, email, user/org metadata | Replace with actual production configuration |
| Stripe | Billing and subscription management | Billing contact, payment status, transaction metadata | Card data handled by Stripe |
| Hosting provider | Application hosting | App data, logs | Confirm provider and region |
| Database provider | Product database | Workspace, campaign, user and lead data | Confirm provider and region |
| Resend or email provider | Transactional email | Email address, email content | Confirm sender/domain |
| AI provider if enabled | AI-assisted draft generation | Prompt and content data submitted | Avoid unnecessary sensitive data |
| Analytics provider if enabled | Product analytics | Usage events and identifiers | Use consent/contract basis as appropriate |

Do not publish this table externally until production providers, regions and contracts are confirmed.
