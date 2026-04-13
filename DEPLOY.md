# Repurly premium brand refresh bundle v2

This version fixes the route issue and removes homepage copy that sounded like internal notes.

## What changed in v2
- All sign-in and sign-up CTAs now point to the full live domain:
  - https://app.repurly.org/sign-in
  - https://app.repurly.org/sign-up
- UTM parameters are included on the main CTA links.
- Homepage copy now speaks directly to first-time visitors.
- Internal wording like "this refresh" or "safe deployment" has been removed from the public page.

## Included
- index.html
- brand.css
- assets/repurly-logo.png
- assets/jakoma-logo.jpg
- app-shell-brand-tokens.css
- DEPLOY.md

## Deploy
1. Back up your current homepage files.
2. Replace the current homepage index.html with this bundle's index.html.
3. Upload brand.css.
4. Upload the assets folder.
5. Test:
   - https://app.repurly.org/
   - https://app.repurly.org/sign-in
   - https://app.repurly.org/sign-up
6. Click every CTA on desktop and mobile.

## UTM pattern used
utm_source=repurly-homepage
utm_medium=<placement>
utm_campaign=brand-refresh
utm_content=<button-or-link>

You can change those later if needed.
