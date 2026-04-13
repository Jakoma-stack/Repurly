export type RetryGuidance = {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export function getProviderRetryGuidance(provider: string, status: string, payload?: Record<string, unknown> | null): RetryGuidance[] {
  const guidance: RetryGuidance[] = [];
  const lowerProvider = provider.toLowerCase();
  const message = String(payload?.userMessage ?? payload?.message ?? payload?.note ?? '');
  const containerStatus = String(payload?.containerStatus ?? payload?.status_code ?? payload?.providerStatus ?? '').toUpperCase();
  const raw = `${message} ${containerStatus}`.toUpperCase();

  if (status === 'failed') {
    guidance.push({
      title: 'Review the latest provider rejection',
      body: message || `The ${lowerProvider} adapter returned a non-retryable failure. Review the raw payload and the connected account permissions before retrying.`,
      actionLabel: 'Open channel health',
      actionHref: '/app/channels',
    });
  }

  if (lowerProvider === 'linkedin' && raw.includes('TOO_MANY_REQUESTS') && raw.includes('DAY LIMIT')) {
    guidance.unshift({
      title: 'LinkedIn daily publish limit reached',
      body: 'LinkedIn is throttling this member for the day. Do not keep retrying every few minutes. Slow scheduling down and try again after the next quota window.',
      actionLabel: 'Open calendar and queue',
      actionHref: '/app/calendar',
    });
  }

  if (raw.includes('EXPIRED') || raw.includes('INVALID TOKEN') || raw.includes('UNAUTHORIZED') || raw.includes('ACCESS TOKEN')) {
    guidance.push({
      title: 'Reconnect the channel before retrying',
      body: 'This looks like an expired or invalid provider token. Reconnect the affected channel first, then retry the publish attempt.',
      actionLabel: 'Open channels',
      actionHref: '/app/channels',
    });
  }

  if (raw.includes('RATE LIMIT') || raw.includes('TOO_MANY_REQUESTS')) {
    guidance.push({
      title: 'Slow down retries',
      body: 'The provider is rate-limiting requests. Reduce the scheduling burst, wait longer between retries, and avoid replaying multiple jobs at once.',
    });
  }

  if (lowerProvider === 'instagram') {
    if (containerStatus.includes('IN_PROGRESS') || status === 'processing') {
      guidance.push({
        title: 'Keep the Instagram container queued',
        body: 'Meta is still processing the media container. Do not duplicate the request unless the container stalls well beyond the normal processing window.',
      });
    }
    guidance.push({
      title: 'Check media and page ownership',
      body: 'Confirm the connected Meta Page still owns the Instagram Business account and that every carousel item or video uses a publicly reachable asset URL.',
      actionLabel: 'Open channels',
      actionHref: '/app/channels',
    });
  }

  if (lowerProvider === 'youtube') {
    guidance.push({
      title: 'Verify upload processing before retrying',
      body: 'YouTube uploads often remain processing after acceptance. Prefer waiting for the provider callback before forcing another attempt.',
    });
  }

  if (lowerProvider === 'x') {
    guidance.push({
      title: 'Reconnect if scopes drifted',
      body: 'X failures commonly come from revoked write scopes or account-level posting restrictions. Reconnect the channel before you retry.',
      actionLabel: 'Reconnect X',
      actionHref: '/app/channels',
    });
  }

  if (lowerProvider === 'facebook') {
    guidance.push({
      title: 'Confirm page token freshness',
      body: 'Facebook Page posting depends on the connected user still holding valid page permissions. If a retry fails again, reconnect the page token.',
    });
  }

  if (!guidance.length) {
    guidance.push({
      title: 'Retry with the stored identifiers',
      body: 'Use the provider correlation, container, and upload IDs below to confirm the remote state before forcing a replay.',
    });
  }

  return guidance;
}
