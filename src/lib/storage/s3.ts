import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getRegion() {
  return process.env.S3_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
}

export function getS3Client() {
  if (client) {
    return client;
  }

  const region = getRegion();
  if (!region) {
    throw new Error("S3_REGION is missing");
  }

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  client = new S3Client({
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
  });

  return client;
}
