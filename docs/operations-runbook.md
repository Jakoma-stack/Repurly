# Operations runbook

## Daily checks
- Visit `/ops/health`
- Review failed posts on `/ops`
- Review publish attempts and audit log
- Confirm new workspace signups are flowing into billing or follow-up

## Backup set
Back up these directories together:
- `database/`
- `content/`
- `output/`
- `config/brands/`

## Safe LinkedIn rollout
1. Keep `LINKEDIN_DRY_RUN=true`
2. Test one approved post end to end
3. Confirm correct `linkedin_author_urn`
4. Confirm correct brand token env name
5. Switch `LINKEDIN_DRY_RUN=false` for one controlled post only

## Incident response
- If live posting behaves unexpectedly, set `LINKEDIN_DRY_RUN=true`
- Recheck the affected row in `data/social_post_schedule.csv`
- Review `/ops/publish-attempts` and `/ops/audit`
- Restore from backup if filesystem state is corrupted
