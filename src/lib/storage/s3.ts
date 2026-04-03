import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

export function getS3Client() {
  if (client) return client;

  client = new S3Client({
    region: required("S3_REGION"),
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });

  return client;
}