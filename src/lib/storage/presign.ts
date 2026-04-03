import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "@/lib/storage/s3";

export async function createPresignedUpload(objectKey: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
  return {
    url,
    objectKey,
    publicUrl: process.env.S3_PUBLIC_BASE_URL ? `${process.env.S3_PUBLIC_BASE_URL}/${objectKey}` : null,
  };
}
