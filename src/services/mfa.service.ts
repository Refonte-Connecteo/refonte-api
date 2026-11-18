import { createHash, randomInt } from "node:crypto";
import { generateSecret, generateURI, generateSync, verifySync } from "otplib";
import QRCode from "qrcode";

export const MFA_ISSUER = "MonApp";
export const MFA_TOKEN_TTL = "10m" as const;

const MFA_EPOCH_TOLERANCE_SECONDS = 30;
const MFA_QR_WIDTH = 300;

export function createMfaSecret(): string {
  return generateSecret();
}

export function createOtpAuthUri(secret: string, email: string): string {
  return generateURI({ issuer: MFA_ISSUER, label: email, secret });
}

export async function createQrCodeDataUri(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, { width: MFA_QR_WIDTH, margin: 1 });
}

export function generateTotpCode(secret: string): string {
  return generateSync({ secret });
}

export function isValidTotpCode(code: string, secret: string): boolean {
  return verifySync({ secret, token: code, epochTolerance: MFA_EPOCH_TOLERANCE_SECONDS }).valid;
}

export function isSixDigitCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code);
}

// --------------------------------------------------------------------------
// Codes de secours : permettent de se connecter sans le téléphone (perdu, changé).
// 10 codes à usage unique de 8 caractères, montrés une seule fois ; seule leur empreinte
// SHA-256 est stockée (40 bits d'aléa chacun, et la connexion reste limitée en débit).
// --------------------------------------------------------------------------

/** Sans 0/O, 1/I/L : pas de confusion à la recopie. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 8;

/** Majuscules, sans tiret ni espace : « abcd-efgh » et « ABCDEFGH » sont le même code. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isRecoveryCodeFormat(code: unknown): code is string {
  if (typeof code !== "string" || code.length > 20) return false;
  const normalized = normalizeRecoveryCode(code);
  return normalized.length === RECOVERY_CODE_LENGTH && [...normalized].every((c) => RECOVERY_ALPHABET.includes(c));
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Codes affichés à l'utilisateur, au format XXXX-XXXX. */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const chars = Array.from({ length: RECOVERY_CODE_LENGTH }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]);
    return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
  });
}
