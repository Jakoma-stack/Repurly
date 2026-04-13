# Repurly premium brand refresh bundle

This bundle is designed to be deployment-safe.

## Included
- `index.html` – revised homepage
- `brand.css` – styling for the revised homepage
- `assets/repurly-logo.png` – supplied Repurly logo
- `assets/jakoma-logo.jpg` – supplied Jakoma logo
- `app-shell-brand-tokens.css` – optional app shell token layer
- `DEPLOY.md` – this file

## Safe deployment path
1. Back up your current homepage files.
2. Replace your current homepage `index.html` with this bundle's `index.html`.
3. Add `brand.css` alongside it.
4. Upload the `assets` folder alongside the homepage.
5. Check:
   - `/`
   - `/sign-in`
   - `/sign-up`
   - mobile menu
   - logo loading
6. If your app framework uses a static public folder, place:
   - `index.html`
   - `brand.css`
   - `assets/*`
   into that public/static location.

## Important
- This refresh does **not** change app logic.
- It does **not** touch authentication, workflow, queue, AI, or database behaviour.
- It only refreshes the public-facing homepage and gives you optional design tokens for the app shell.

## Optional next step
If you want the in-app surfaces to match this homepage more closely, use `app-shell-brand-tokens.css` to map the same colors and radii into your app shell in a controlled way.
