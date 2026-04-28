# Repurly LinkedIn company-page patch

This patch fixes the main reasons Repurly was defaulting to a personal LinkedIn profile instead of a company page.

## What changed

- Added safer LinkedIn configuration resolution.
  - Supports the standard env vars:
    - `LINKEDIN_CLIENT_ID`
    - `LINKEDIN_CLIENT_SECRET`
    - `LINKEDIN_REDIRECT_URI`
    - `LINKEDIN_SCOPE`
  - Also supports legacy suffixed env vars such as:
    - `LINKEDIN_CLIENT_ID_Repurly`
    - `LINKEDIN_CLIENT_SECRET_Repurly`
    - `LINKEDIN_REDIRECT_URI_Repurly`
    - `LINKEDIN_SCOPE_Repurly`
  - You can force a specific suffixed set with `LINKEDIN_ENV_KEY`.

- Persisted the LinkedIn config selection through OAuth state.
  - The callback now exchanges the code using the same LinkedIn app credentials and redirect URI that were used to start sign-in.

- Updated LinkedIn REST version handling.
  - Added `LINKEDIN_API_VERSION` with a default of `202603`.

- Improved company-page discovery behaviour.
  - Repurly now surfaces company-page sync problems instead of silently swallowing them.
  - OAuth still succeeds for the member profile, but Channels now shows a clear warning when organization lookup fails.

- Prefer company pages as the default target when discovered.
  - On connect/reconnect, if a LinkedIn company page is available, Repurly now prefers it as the workspace default target.

- Clarified the Channels UX copy.
  - The UI now explains that LinkedIn does not show a company-page picker during sign-in.
  - Company pages are discovered after connect and selected inside Repurly.

## Required LinkedIn setup

For company-page posting/discovery to work reliably, the LinkedIn app and member account still need the right access:

- The signed-in LinkedIn member must administer the company page.
- The LinkedIn app must be approved for the organization/page permissions you request.
- Your environment scope should include the company-page permissions you actually have approval for.

Suggested scope set in this patch:

`openid profile email w_member_social w_organization_social rw_organization_admin`

## Files changed

- `src/lib/linkedin/config.ts`
- `src/lib/linkedin/oauth.ts`
- `src/lib/linkedin/client.ts`
- `src/lib/linkedin/service.ts`
- `src/lib/linkedin/publisher.ts`
- `src/lib/integrations/service.ts`
- `src/app/api/linkedin/callback/route.ts`
- `src/app/app/channels/page.tsx`
- `.env.example`
- `src/.env.example`

## Important

The source zip included local environment files with real-looking secrets. Those files were excluded from the patched zip. Rotate any exposed LinkedIn, Stripe, Clerk, database, or storage credentials before deploying.
