# Commercial launch notes

This branch removes legacy launch-facing copy from the customer and public experience, fixes the premium content calendar crash, and adds due-time LinkedIn posting support.

## External setup still required
- Stripe live keys and webhook
- SMTP mailbox credentials
- LinkedIn live credentials per brand
- Render cron job for `python scripts/post_due_linkedin.py`

## Supported live publishing
- LinkedIn text posts
- LinkedIn single-image posts

## Not yet sold as fully supported
- Live LinkedIn multi-image publishing
