# X + Facebook Pages live integration notes

This build moves X and Facebook Pages beyond placeholder adapters.

## X
- OAuth connect route: `/api/x/connect`
- OAuth callback: `/api/x/callback`
- Token storage: encrypted in `integrations`
- Token refresh: handled through the shared integration service
- Account discovery: saves the connected profile into `platform_accounts`
- Live publishing: text posts are wired through the X create-post endpoint
- Remaining work: media upload and chunked video upload

## Facebook Pages
- OAuth connect route: `/api/facebook/connect`
- OAuth callback: `/api/facebook/callback`
- Page discovery: reads available pages and stores them in `platform_accounts`
- Live publishing: page text posts and link posts are wired through the Graph API feed endpoint
- Remaining work: image and video media upload flows, page token refresh hardening

## Why this matters
The shared orchestration layer stays unchanged. Inngest still schedules a generic publish job, then the platform registry selects the correct adapter.

That means every new channel gets:
- shared approvals
- shared scheduling
- shared audit and publish job state
- channel-specific auth and publishing logic kept in one place
