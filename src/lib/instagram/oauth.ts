import { createOAuthState, verifyOAuthState } from '@/lib/oauth/state';

export type InstagramOAuthState = { workspaceId: string; userId: string; provider: 'instagram' };

export function buildInstagramAuthUrl(workspaceId: string, userId: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? '',
    redirect_uri: process.env.INSTAGRAM_REDIRECT_URI ?? '',
    scope: process.env.INSTAGRAM_SCOPE ?? 'instagram_basic,instagram_content_publish,pages_show_list,business_management',
    response_type: 'code',
    state: createOAuthState({ workspaceId, userId, provider: 'instagram' } satisfies InstagramOAuthState),
  });

  return new URL(`https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`);
}

export function parseInstagramState(state: string) {
  const payload = verifyOAuthState<InstagramOAuthState>(state);
  if (!payload.workspaceId || !payload.userId || payload.provider !== 'instagram') throw new Error('Invalid Instagram OAuth state');
  return payload;
}
