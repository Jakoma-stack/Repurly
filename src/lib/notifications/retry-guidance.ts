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

  if (status === 'failed') {
    guidance.push({
      title: 'Review the latest provider rejection',
      body: message || `The ${lowerProvider} adapter returned a non-retryable failure. Review the raw payload and the connected account permissions before retrying.`,
      actionLabel: 'Open channel health',
      actionHref: '/app/channels',
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
