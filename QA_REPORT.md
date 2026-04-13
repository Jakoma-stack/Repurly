# QA report

## Static QA completed
- Reviewed settings admin flow, billing pages, pricing docs, email client initialization, and plan limits.
- Patched operator-control and invite actions so Next.js redirects are not incorrectly treated as failures.
- Aligned pricing across marketing, billing, catalog, and docs.
- Added brand limits to usage metering so Team and Agency positioning is visible and consistent.
- Switched email client creation to lazy initialization to avoid build-time crashes.

## Recommended runtime QA
- Settings operator toggles
- Invite create / revoke / accept
- Billing checkout for Solo / Team / Agency
- Billing usage brand count
- LinkedIn company-page default target and publish test
