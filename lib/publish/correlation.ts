export type ProviderCorrelation = {
  correlationId?: string;
  containerId?: string;
  uploadId?: string;
};

function readString(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

export function extractProviderCorrelation(raw?: Record<string, unknown>, fallbackId?: string): ProviderCorrelation {
  return {
    correlationId:
      readString(raw, ['correlationId', 'providerCorrelationId', 'externalPostId', 'postId', 'mediaId', 'urn']) ?? fallbackId,
    containerId: readString(raw, ['containerId', 'creationId', 'instagramContainerId', 'videoContainerId']),
    uploadId: readString(raw, ['uploadId', 'videoUploadId', 'mediaUploadId', 'assetUploadId']),
  };
}
