import type { Algorithm } from "jsonwebtoken";
import { assertEncryptionKey } from "../utils/crypto.utils.js";
import {
  assertNoSecretReuse,
  assertStrongJwtSecret,
} from "./secrets.config.js";

export { assertStrongJwtSecret };

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const JWT_ALGORITHM: Algorithm = "HS256";

export const env = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_ALGORITHM,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "5m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3001",
  ALLOWED_REDIRECT_DOMAINS: (process.env.ALLOWED_REDIRECT_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
  AUDIT_RETENTION_DAYS: parseInt(process.env.AUDIT_RETENTION_DAYS || "7", 10),
  // Politique de rétention RGPD (purge automatique des données expirées)
  APPLICATION_RETENTION_MONTHS: parseInt(process.env.APPLICATION_RETENTION_MONTHS || "24", 10),
  CONTACT_MESSAGE_RETENTION_MONTHS: parseInt(
    process.env.CONTACT_MESSAGE_RETENTION_MONTHS || "12",
    10,
  ),
  PAGE_VIEW_RETENTION_DAYS: parseInt(process.env.PAGE_VIEW_RETENTION_DAYS || "395", 10),
};

assertStrongJwtSecret(env.JWT_SECRET);
assertEncryptionKey(process.env.ENCRYPTION_KEY ?? "");
assertNoSecretReuse(env.JWT_SECRET, process.env.ENCRYPTION_KEY ?? "");
