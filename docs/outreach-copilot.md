# Repurly Outreach Copilot

Outreach Copilot turns manual prospect finds into a scored, human-approved action queue.

It removes the pain of outreach without turning Repurly into a scraper, auto-DM bot, or fake engagement tool.

## What it does

- Manual prospect/page capture
- Fit scoring: send now, warm up first, save for later, or skip
- Draft generation for connection notes, first messages, public comments, follow-ups and referral asks
- Daily queue with next action dates
- Human-approved action logging
- Existing lead pipeline reuse via `lead_pipeline.metadata`

## What it deliberately does not do

- No LinkedIn scraping
- No Facebook scraping
- No automated cold DMs
- No auto-commenting
- No auto-liking
- No fake engagement
- No bulk sending

Repurly prepares and tracks the work. A human decides, copies, adapts and sends.

## Where to find it

App route: `/app/outreach-copilot`

Navigation label: `Outreach Copilot`

## Data model

This build does not require a new database table. It reuses `lead_pipeline` and stores Outreach Copilot-specific fields in `metadata` with `copilotVersion: manual-v1`.

## Suggested operator workflow

1. Add five prospects or pages manually.
2. Let Repurly score each one.
3. Work only the daily queue.
4. Use the generated draft as a starting point.
5. Send manually using the platform/contact route.
6. Mark the action done and set the next action date.
7. Stop when the queue is complete.

## Commercial positioning

Human-approved LinkedIn content, engagement and follow-up workflow. Repurly helps teams know what to post, what needs approval, who needs a reply, and which leads need a next action - without scraping, auto-DMs or fake engagement.
