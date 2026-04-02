# Live LinkedIn posting setup

This build fixes the customer content studio calendar crash and adds a safer LinkedIn posting path for launch.

## What changed
- The customer content calendar no longer crashes when schedule days contain post items.
- The LinkedIn publisher can now post only rows that are due at or before the current UTC time.
- Brand posting credentials can fall back to the SQLite `brands` table if the JSON file is stale or incomplete.

## Recommended launch setup
1. Keep `LINKEDIN_DRY_RUN=false` only for brands you have verified.
2. Add a brand-specific access token environment variable in Render, for example:
   - `LINKEDIN_ACCESS_TOKEN_JAKOMA`
3. Make sure the brand has:
   - `linkedin_author_urn`
   - `linkedin_token_env`
4. Create a Render Cron Job that runs every 5 minutes using:

```bash
python scripts/post_due_linkedin.py
```

This will publish eligible LinkedIn posts whose `post_date` and `post_time` are now due.

## Manual safety fallback
If needed, ops can still publish or retry one post at a time from `/ops/schedule/<post_id>`.

## Current commercial support
- Text posts: supported
- Single image posts: supported
- Carousel / multi-image posts: supported
