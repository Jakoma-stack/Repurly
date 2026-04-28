# Instagram publish-status polling and failure UX

This build upgrades Instagram publishing from an API-wired flow to a production-grade operational flow.

## What changed

- Repurly now polls Meta container status before calling `media_publish`.
- Single-image, video, and multi-image carousel workflows all wait for container readiness.
- Publish jobs no longer collapse every in-progress Meta response into a generic failure.
- The platform now stores user-facing failure guidance in `post_targets.result` and `posts.metadata.lastPublishResult`.

## Stored result shape

Instagram publish results now persist a richer shape:

- `phase`: `processing`, `container_processing`, `carousel_processing`, `published`, or `failed`
- `retryable`: whether Repurly should retry automatically
- `userMessage`: the human-readable explanation to show in the product
- `action`: suggested next step such as `wait_for_processing`, `replace_media`, `replace_video`, `reconnect_instagram`, or `fix_asset_url`
- `containerStatus`: per-container status snapshots for video and carousel workflows

## Workflow behavior

### Video

1. Create media container.
2. Poll Meta until the container is ready, fails, or the polling window is exhausted.
3. If ready, publish.
4. If still processing, keep the job queued and preserve the scheduled post.
5. If failed, mark the target failed with a user-facing fix message.

### Carousel

1. Create each child image container.
2. Poll every child until ready.
3. Build the carousel container.
4. Poll the carousel container.
5. Publish only when the carousel is fully ready.

## Product-facing UX expectations

When you wire the next surface in the app, show these values directly:

- current phase
- retryable or not
- user message
- suggested next action
- last container status code

This lets Repurly say things like:

- "Instagram is still processing your video. We’ll retry automatically."
- "Instagram rejected one of the carousel images. Replace the media and try again."
- "Reconnect Instagram because the workspace no longer has a usable page token."

## Environment tuning

These env vars control the polling window:

- `INSTAGRAM_STATUS_MAX_POLLS` default `12`
- `INSTAGRAM_STATUS_POLL_INTERVAL_MS` default `5000`

That gives a default wait window of about 60 seconds before leaving the job queued for a later retry.
