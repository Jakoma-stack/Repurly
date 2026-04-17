import crypto from 'crypto';

export function buildPublishIdempotencyKey(input: {
  postId: string;
  postTargetId?: string | null;
  provider: string;
  scheduledFor: string | Date;
}) {
  const base = `${input.provider}:${input.postId}:${input.postTargetId ?? 'workspace'}:${new Date(input.scheduledFor).toISOString()}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}
