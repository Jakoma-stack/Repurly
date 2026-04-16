import { randomBytes } from 'crypto';

import { buildAppUrl } from '@/lib/app-url';

function getLinkedInRedirectUri(requestUrl?: string) {
  return process.env.LINKEDIN_REDIRECT_URI?.trim() || buildAppUrl('/api/linkedin/callback', requestUrl);
}

export function buildLinkedInAuthUrl(workspaceId: string, requestUrl?: string) {
  const state = Buffer.from(JSON.stringify({ workspaceId, nonce: randomBytes(8).toString('hex') })).toString('base64url');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID?.trim() ?? '',
    redirect_uri: getLinkedInRedirectUri(requestUrl),
    state,
    scope: process.env.LINKEDIN_SCOPE?.trim() ?? '',
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function parseLinkedInState(state: string) {
  return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
    workspaceId: string;
    nonce: string;
  };
}

export function getLinkedInRedirectUriForServer(requestUrl?: string) {
  return getLinkedInRedirectUri(requestUrl);
}
