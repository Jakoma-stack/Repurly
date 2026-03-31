# Repurly

Repurly is a LinkedIn-first content operations app for agencies managing multiple client brands.

This deployment-ready package includes:
- the Flask app and templates
- onboarding, workspace, billing, and scheduling flows
- LinkedIn posting support for text and single-image posts
- example data files and database schema
- deployment and operations documentation

## Public commercial positioning

- **Plan name:** Repurly Agency
- **Price:** GBP 297/month
- **Primary Stripe env var:** `STRIPE_PRICE_AGENCY`

## Package contents

- `scripts/` application logic
- `templates/` app templates
- `database/schema.sql` SQLite schema
- `data/` example CSVs
- `docs/` deployment, billing, customer workflow, and operations notes
- `index.html`, `privacy.html`, `terms.html` marketing and legal pages

## What was removed from this deployment package

This cleaned package excludes local-only or internal planning material such as:
- `.env`
- SQLite runtime database files
- logs and output exports
- Python caches and pytest cache
- internal phase plans and working notes

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.production.example .env
python scripts/init_db.py
python scripts/bootstrap_demo_data.py
python scripts/check_setup.py
```

## Environment

Important environment variables include:
- `APP_BASE_URL`
- `MARKETING_SITE_URL`
- `PUBLIC_SUPPORT_EMAIL`
- `OPS_USERNAME`
- `OPS_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_AGENCY`
- `STRIPE_WEBHOOK_SECRET`
- LinkedIn token variables as required

## Run locally

```bash
python scripts/onboarding_app.py
```

## Production entrypoint

```bash
gunicorn --bind 0.0.0.0:${PORT:-5050} wsgi:app
```

## Safe live scope

Repurly should currently be sold and operated as supporting:
- LinkedIn text posts
- LinkedIn single-image posts

Carousel workflows can be prepared in the system, but should not yet be sold as fully supported live publishing.

## Checks before deployment

```bash
python scripts/check_setup.py
python scripts/validate_schedule.py
python -m pytest -q tests
```
