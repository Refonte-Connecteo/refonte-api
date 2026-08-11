import { z } from "zod";

const EXTERNAL_HTTP_URL = /^https?:\/\/[^\s]+$/i;

/**
 * Accepte un chemin de fichier local (uploads/ ou images/ statiques) ou une
 * URL http(s) externe (stockage S3/R2). Rejette javascript:, data:, etc.
 */
export function isValidStoredUrl(value: string): boolean {
  return (
    value.startsWith("/uploads/") ||
    value.startsWith("/images/") ||
    EXTERNAL_HTTP_URL.test(value)
  );
}

export const storedUrlSchema = z
  .string()
  .max(500)
  .refine(isValidStoredUrl, {
    message: "URL de fichier invalide (chemin /uploads, /images ou URL http(s))",
  });
