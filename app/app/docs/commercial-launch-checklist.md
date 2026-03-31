# Commercial launch checklist

## Public site
- Publish the repository root on `https://repurly.org`
- Confirm every primary CTA points to `https://beta.repurly.org/beta`
- Confirm support email is `support@repurly.org`
- Check privacy, terms, robots, sitemap, favicon and social preview

## Beta app
- Publish `System/` on `https://beta.repurly.org`
- Use persistent storage for `database/`, `content/`, `output/` and uploads
- Protect `/ops`, `/api/ops`, and `/onboarding/brand` with strong basic auth
- Keep `LINKEDIN_DRY_RUN=true` until a single controlled live test succeeds

## Before accepting paid customers
- Set Stripe keys and price IDs if checkout is enabled
- Verify one successful beta signup save without checkout
- Verify one successful Stripe checkout when billing is enabled
- Confirm `/healthz` and `/ops/health` both respond after deploy
- Back up `database/`, `content/`, `output/`, and `config/brands/`

## Remaining non-technical review item
- Review public legal entity and business correspondence wording against your final jurisdiction and commercial agreements
