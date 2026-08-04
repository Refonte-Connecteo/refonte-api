import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function readStorageConfig(): StorageConfig | null {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint && !bucket && !accessKeyId && !secretAccessKey) {
    return null;
  }

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3/R2 is partially configured: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must all be set together.",
    );
  }

  if (!endpoint.startsWith("https://")) {
    throw new Error(
      "S3_ENDPOINT must use HTTPS: the S3/R2 SDK calls are only allowed over TLS (audit requirement).",
    );
  }

  return {
    endpoint,
    region: process.env.S3_REGION || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

let cachedClient: S3Client | null = null;

export function getS3Client(config: StorageConfig): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

export interface UploadFileParams {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export async function uploadFile(params: UploadFileParams): Promise<string> {
  const config = readStorageConfig();
  if (!config) {
    throw new Error("S3/R2 storage is not configured (S3_ENDPOINT, S3_BUCKET, ...)");
  }

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    ServerSideEncryption: "AES256",
  });

  await getS3Client(config).send(command);

  return publicUrl(config, params.key);
}

export async function deleteFile(key: string): Promise<void> {
  const config = readStorageConfig();
  if (!config) {
    return;
  }

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  await getS3Client(config).send(command);
}

export function isStorageConfigured(): boolean {
  return readStorageConfig() !== null;
}

export function publicUrl(config: StorageConfig, key: string): string {
  return `${config.endpoint}/${config.bucket}/${key}`;
}
