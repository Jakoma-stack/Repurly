# Deployment checklist for repurly.org

## Recommended shape

- Serve the marketing site from the repository root on `https://repurly.org`
- Serve the Flask customer and ops app from `app/` on `https://app.repurly.org`
- Protect `/ops`, `/api/ops`, and `/onboarding/brand` with `OPS_USERNAME` and `OPS_PASSWORD`

## Required environment variables

- `APP_BASE_URL=https://app.repurly.org`
- `MARKETING_SITE_URL=https://repurly.org`
- `PUBLIC_SUPPORT_EMAIL=support@repurly.org`
- `OPS_USERNAME=<strong-admin-user>`
- `OPS_PASSWORD=<strong-admin-password>`
- `LINKEDIN_DRY_RUN=false` only when you are ready for live posting
- `LINKEDIN_ACCESS_TOKEN` or brand-specific LinkedIn token env vars
- Stripe keys and webhook secret if billing is enabled

## Before switching live posting on

- Confirm every brand has the correct `linkedin_author_urn`
- Confirm every brand token env var points to the right account
- Keep `LINKEDIN_DRY_RUN=true` until a controlled single-brand live test succeeds
- Set upload auth before exposing the app publicly

## Launch checks

- `python scripts/check_setup.py`
- `python scripts/validate_schedule.py`
- `python -m pytest -q tests`
- Verify `/ops/health` after deployment
