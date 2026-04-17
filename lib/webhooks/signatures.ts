import crypto from 'crypto';

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, secret?: string) {
  if (!secret) return false;
  const received = signatureHeader?.replace(/^sha256=/, '') ?? '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return Boolean(received) && safeCompare(received, expected);
}

export function verifyXSignature(rawBody: string, signatureHeader: string | null, secret?: string) {
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return Boolean(signatureHeader) && safeCompare(signatureHeader ?? '', expected);
}

export function verifyYoutubeSignature(rawBody: string, tokenHeader: string | null, secret?: string) {
  if (!secret) return false;
  const expected = crypto.createHash('sha256').update(`${secret}:${rawBody}`).digest('hex');
  return Boolean(tokenHeader) && safeCompare(tokenHeader ?? '', expected);
}
