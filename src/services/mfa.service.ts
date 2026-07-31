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
