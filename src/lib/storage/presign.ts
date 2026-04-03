import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "@/lib/storage/s3";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

export async function createPresignedUpload(objectKey: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: required("S3_BUCKET"),
    Key: objectKey,
    ContentType: contentType,
  });

  const url = await getSignedUrl(getS3Client(), command, { expiresIn: 60 * 5 });

  return {
    url,
    objectKey,
    publicUrl: process.env.S3_PUBLIC_BASE_URL
      ? `${process.env.S3_PUBLIC_BASE_URL}/${objectKey}`
      : null,
  };
}