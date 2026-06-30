import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { envConfig } from './env.config';

export const s3Client = new S3Client({
  region: envConfig.s3Config.region,
  credentials: {
    accessKeyId: envConfig.s3Config.accessKeyId,
    secretAccessKey: envConfig.s3Config.secretAccessKey,
  },
});

export const S3_BUCKET = envConfig.s3Config.bucketName;

export function buildS3Key(serviceId: number, filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'pdf';
  return `catalogues/service-${serviceId}-${Date.now()}.${ext}`;
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return `https://${S3_BUCKET}.s3.${envConfig.s3Config.region}.amazonaws.com/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

export function extractS3Key(fileUrl: string): string | null {
  const bucket = S3_BUCKET;
  const regex = new RegExp(`https://${bucket}\\.s3\\.[^/]+/amazonaws\\.com/(.+)`);
  const match = fileUrl.match(regex);
  return match ? match[1] : null;
}
