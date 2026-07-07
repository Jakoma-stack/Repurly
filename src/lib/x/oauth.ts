import { createHash, randomBytes } from 'crypto';
import { createOAuthState, verifyOAuthState } from '@/lib/oauth/state';

export type XStatePayload = { workspaceId: string; userId: string; verifier: string };

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function buildPkcePair() {
  const verifier = toBase64Url(randomBytes(32));
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildXAuthUrl(workspaceId: string, userId: string) {
  const pkce = buildPkcePair();
  const state = createOAuthState({ workspaceId, userId, verifier: pkce.verifier } satisfies XStatePayload);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID ?? '',
    redirect_uri: process.env.X_REDIRECT_URI ?? '',
    state,
    scope: process.env.X_SCOPE ?? 'tweet.read tweet.write users.read offline.access media.write',
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
  });

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export function parseXState(state: string) {
  const payload = verifyOAuthState<XStatePayload>(state);
  if (!payload.workspaceId || !payload.userId || !payload.verifier) throw new Error('Invalid X OAuth state');
  return payload;
}
