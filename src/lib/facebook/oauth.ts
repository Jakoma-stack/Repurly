import { createOAuthState, verifyOAuthState } from '@/lib/oauth/state';

export type FacebookOAuthState = { workspaceId: string; userId: string };

export function buildFacebookAuthUrl(workspaceId: string, userId: string) {
  const state = createOAuthState({ workspaceId, userId } satisfies FacebookOAuthState);
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? '',
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI ?? '',
    state,
    scope: process.env.FACEBOOK_SCOPE ?? 'pages_show_list,pages_manage_posts,pages_read_engagement,business_management',
    response_type: 'code',
  });
  return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
}

export function parseFacebookState(state: string) {
  const payload = verifyOAuthState<FacebookOAuthState>(state);
  if (!payload.workspaceId || !payload.userId) throw new Error('Invalid Facebook OAuth state');
  return payload;
}
