# Repurly

Repurly is a LinkedIn-first content operations platform for agencies.

## Current commercial offer

- **Public plan:** Repurly Agency
- **Recurring price:** **£297/month**
- **Setup path:** **£750 one-off** onboarding and launch support
- **Expansion:** additional brands or managed support handled as custom commercial work

## What this repo contains

- the working Flask app and customer workspace
- billing, onboarding, workspaces, brand management, drafting, review, scheduling, and publish tracking
- customer, ops, and deployment documentation
- tests for auth, billing, onboarding, workspace, and delivery workflows

## Canonical billing configuration

Use these environment variables:

```bash
STRIPE_PRICE_AGENCY=price_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Legacy price vars can still be accepted for compatibility, but **`STRIPE_PRICE_AGENCY` is the canonical variable**.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python scripts/init_db.py
python scripts/bootstrap_demo_data.py
python scripts/check_setup.py
```

## Run locally

```bash
python scripts/onboarding_app.py
```

Production entrypoint:

```bash
gunicorn --bind 0.0.0.0:${PORT:-5050} wsgi:app
```


## Live domains

- Marketing site: `https://repurly.org`
- Customer app: `https://app.repurly.org`
- Customer login: `https://app.repurly.org/login`
- Ops console: `https://app.repurly.org/ops`
