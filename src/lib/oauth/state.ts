import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STATE_TTL_MS = 10 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;

type StateEnvelope<T extends Record<string, unknown>> = T & {
  issuedAt: number;
  nonce: string;
};

function getStateSecret() {
  const raw = process.env.OAUTH_STATE_SECRET || process.env.TOKEN_ENCRYPTION_SECRET || process.env.CLERK_SECRET_KEY;

  if (!raw || raw.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `OAUTH_STATE_SECRET, TOKEN_ENCRYPTION_SECRET, or CLERK_SECRET_KEY must be set to at least ${MIN_SECRET_LENGTH} characters before OAuth can start.`,
    );
  }

  return raw;
}

function sign(encodedPayload: string) {
  return createHmac('sha256', getStateSecret()).update(encodedPayload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createOAuthState<T extends Record<string, unknown>>(payload: T) {
  const envelope: StateEnvelope<T> = {
    ...payload,
    issuedAt: Date.now(),
    nonce: randomBytes(16).toString('hex'),
  };

  const encodedPayload = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyOAuthState<T extends Record<string, unknown>>(state: string): StateEnvelope<T> {
  const [encodedPayload, signature, unexpected] = state.split('.');

  if (!encodedPayload || !signature || unexpected) {
    throw new Error('Invalid OAuth state format');
  }

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    throw new Error('Invalid OAuth state signature');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as StateEnvelope<T>;
  if (!payload.issuedAt || Date.now() - payload.issuedAt > STATE_TTL_MS) {
    throw new Error('Expired OAuth state');
  }

  return payload;
}
