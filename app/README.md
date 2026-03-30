# Repurly

A LinkedIn-first content operations engine for multi-brand workflows, rebranded for Repurly by Jakoma.

This repository contains two things:
1. the working internal scheduler/posting codebase
2. the execution-plan documents that define the current commercial wedge and build sequence

## Current product wedge

- **ICP:** small agencies managing LinkedIn content for multiple client brands
- **Platform:** LinkedIn only
- **Core promise:** approve and publish a month of client LinkedIn content safely in one workflow
- **Commercial model:** founding agency beta with setup fee plus monthly recurring fee

This repo is intentionally narrow. The strategy is to prove one paid workflow first, then expand.

## What is included

- brand config files
- example scheduling data files
- structured draft generation
- onboarding flow
- LinkedIn posting script
- approval, rejection, retry, and queue management scripts
- asset upload from the ops console
- publish attempt and audit tracking in SQLite
- tests for posting, scheduler extensions, and ops-console workflows
- execution-plan docs in `/docs`

## Repository cleanup decisions

This repo intentionally excludes runtime clutter from the local bundle:
- `.env`
- SQLite database files
- logs
- output files
- `.pytest_cache`
- duplicated nested project copy

## Documentation

- [`docs/phase-0-icp.md`](docs/phase-0-icp.md)
- [`docs/phase-1-product-definition.md`](docs/phase-1-product-definition.md)
- [`docs/revised-execution-plan.md`](docs/revised-execution-plan.md)
- [`docs/repo-review.md`](docs/repo-review.md)

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

On Windows/Git Bash, replace `python` with `py` and activate the Windows venv script.

## Safe run order

```bash
python scripts/validate_schedule.py
python scripts/generate_structured_drafts.py
python scripts/approve_draft.py --post-id jakoma_2026-03-25_linkedin_001 --actor reviewer
python scripts/generate_captions.py
python scripts/build_daily_queue.py --date 2026-03-25
python scripts/post_to_linkedin.py --date 2026-03-25
```

## Demo bootstrap

The repo ships example CSVs only. Create the working filenames expected by the scripts with:

```bash
python scripts/bootstrap_demo_data.py
```

Use `--force` to overwrite the working CSVs with the examples again.


## Ops console

Run the Flask app locally:

```bash
python scripts/onboarding_app.py
```

Production entrypoint:

```bash
gunicorn --bind 0.0.0.0:${PORT:-5050} wsgi:app
```

Useful routes:

- `/ops` dashboard
- `/ops/health` setup and validation checks
- `/ops/schedule` schedule review queue with filters
- `/ops/schedule/<post_id>` post detail with caption preview, asset checks, asset upload, approve/reject actions, retry publish controls, publish attempts, and audit history
- `/ops/brands` brand directory
- `/ops/assets` asset library with attach-existing-asset flow
- `/ops/publish-attempts` recent publish activity
- `/ops/audit` recent audit events
- `/ops/billing` beta intake and subscription records

## Safety notes

- Blank approval states no longer qualify for posting.
- The daily queue only includes posts whose `approval_status` is `approved` or `not_required`.
- Live LinkedIn carousel upload is still not implemented. Multi-image rows can be dry-run validated, but live posting will fail fast.
- Posting now records publish attempts and audit events in SQLite so reruns are easier to review.
- The ops console can upload asset files directly into the correct content folder, attach existing assets from the asset library, and retry failed LinkedIn posts individually or in bulk from the UI.

## Tests

```bash
python -m pytest -q tests
```

## Status

- Strategy/specification for Phase 0 and Phase 1: delivered
- Trust-layer implementation has started with approval hardening plus publish tracking
- Multi-platform expansion is intentionally out of scope until paid LinkedIn pilots succeed


## Production hardening now included

- Gunicorn-ready `Procfile` and `wsgi.py` entrypoint
- Optional HTTP Basic auth for `/ops`, `/api/ops`, and `/onboarding/brand` via `OPS_USERNAME` and `OPS_PASSWORD`
- Safer upload limits and image-type validation for ops asset uploads
- Atomic writes for CSV, JSON, and text updates to reduce file corruption risk
- Default `APP_BASE_URL` set to `https://beta.repurly.org`


## Commercial deployment extras

- `.env.production.example` for production environment setup
- `Dockerfile` and `.dockerignore` for container deployment
- `docs/commercial-launch-checklist.md` for pre-launch review
- `docs/operations-runbook.md` for day-to-day operations and backups
- Root app path `/` now redirects to `/beta` so the beta subdomain has a public landing route
- Public health endpoint `/healthz` and robots disallow route `/robots.txt` added for production hosting
