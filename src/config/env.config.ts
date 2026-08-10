import type { Algorithm } from "jsonwebtoken";
import { assertEncryptionKey } from "../utils/crypto.utils.js";

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const JWT_ALGORITHM: Algorithm = "HS256";

/** Le secret JWT doit contenir au moins 32 caractères cryptographiques (>= 256 bits). */
export function assertStrongJwtSecret(secret: string): void {
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is too weak: it must contain at least 32 cryptographic characters (>= 256 bits). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
}

export const env = {
  PORT: parseInt(process.env.PORT || "3000", 10),
  DATABASE_URL: getEnv("DATABASE_URL"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_ALGORITHM,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "5m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  ALLOWED_REDIRECT_DOMAINS: (process.env.ALLOWED_REDIRECT_DOMAINS || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
};

assertStrongJwtSecret(env.JWT_SECRET);
assertEncryptionKey(process.env.ENCRYPTION_KEY ?? "");
