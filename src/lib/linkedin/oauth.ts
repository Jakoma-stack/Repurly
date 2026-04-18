import { randomBytes } from 'crypto';

import { getLinkedInConfig } from '@/lib/linkedin/config';

export type LinkedInOAuthState = {
  workspaceId: string;
  nonce: string;
  configKey: string;
};

export function buildLinkedInAuthUrl(workspaceId: string, requestUrl?: string) {
  const config = getLinkedInConfig({ requestUrl });
  const state = Buffer.from(JSON.stringify({
    workspaceId,
    nonce: randomBytes(8).toString('hex'),
    configKey: config.key,
  } satisfies LinkedInOAuthState)).toString('base64url');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: config.scope,
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function parseLinkedInState(state: string) {
  return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as LinkedInOAuthState;
}
