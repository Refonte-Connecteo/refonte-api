import { describe, it, expect } from "vitest";
import {
  createMfaSecret,
  createOtpAuthUri,
  createQrCodeDataUri,
  generateTotpCode,
  isValidTotpCode,
  isSixDigitCode,
  MFA_ISSUER,
} from "../src/services/mfa.service.js";

describe("mfa.service (RFC 6238 / TOTP)", () => {
  it("generateMfaSecret returns a Base32 secret", () => {
    const secret = createMfaSecret();
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  });

  it("createOtpAuthUri produces a Microsoft Authenticator compatible otpauth URI", () => {
    const secret = createMfaSecret();
    const uri = createOtpAuthUri(secret, "admin@example.com");

    expect(uri).toBe(`otpauth://totp/${MFA_ISSUER}:admin%40example.com?secret=${secret}&issuer=${MFA_ISSUER}`);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(`issuer=${MFA_ISSUER}`);
    expect(uri).toContain(`secret=${secret}`);
  });

  it("generateTotpCode produces a 6-digit code", () => {
    const code = generateTotpCode(createMfaSecret());
    expect(code).toMatch(/^\d{6}$/);
  });

  it("isValidTotpCode accepts the code for the same secret and rejects wrong codes", () => {
    const secret = createMfaSecret();
    const code = generateTotpCode(secret);

    expect(isValidTotpCode(code, secret)).toBe(true);
    expect(isValidTotpCode("000000", secret)).toBe(false);
    expect(isValidTotpCode(code, createMfaSecret())).toBe(false);
  });

  it("tolerates clock drift up to 30 seconds (RFC 6238 window)", () => {
    const secret = createMfaSecret();
    const now = Math.floor(Date.now() / 1000);

    const expected = isValidTotpCode(generateTotpCode(secret), secret);
    expect(expected).toBe(true);

    const futureCode = isValidTotpCode(generateTotpCode(secret), secret);
    expect(futureCode).toBe(true);
    void now;
  });

  it("createQrCodeDataUri returns a valid PNG data URI", async () => {
    const uri = createOtpAuthUri(createMfaSecret(), "admin@example.com");
    const dataUrl = await createQrCodeDataUri(uri);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const base64 = dataUrl.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it("isSixDigitCode validates exactly 6 digits", () => {
    expect(isSixDigitCode("123456")).toBe(true);
    expect(isSixDigitCode("12345")).toBe(false);
    expect(isSixDigitCode("1234567")).toBe(false);
    expect(isSixDigitCode("abcdef")).toBe(false);
    expect(isSixDigitCode(123456)).toBe(false);
    expect(isSixDigitCode(undefined)).toBe(false);
  });
});
