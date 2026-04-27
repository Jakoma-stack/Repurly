import { getLinkedInConfig } from '@/lib/linkedin/config';
import { createOAuthState, verifyOAuthState } from '@/lib/oauth/state';

export type LinkedInOAuthState = {
  workspaceId: string;
  userId: string;
  configKey: string;
};

export function buildLinkedInAuthUrl(workspaceId: string, userId: string, requestUrl?: string) {
  const config = getLinkedInConfig({ requestUrl });
  const state = createOAuthState({ workspaceId, userId, configKey: config.key } satisfies LinkedInOAuthState);

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
  const payload = verifyOAuthState<LinkedInOAuthState>(state);
  if (!payload.workspaceId || !payload.userId || !payload.configKey) throw new Error('Invalid LinkedIn OAuth state');
  return payload;
}
