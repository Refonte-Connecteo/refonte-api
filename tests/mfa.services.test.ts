import { describe, it, expect, beforeEach, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma.js";
import { env } from "../src/config/env.config.js";
import { createUser, totpCodeFor, resetDatabase } from "./helpers/auth.js";
import {
  confirmMfaSetup,
  verifyMfa,
  setPassword,
} from "../src/services/user.services.js";
import { createMfaSecret } from "../src/services/mfa.service.js";
import { UnauthorizedError, BadRequestError, NotFoundError } from "../src/errors/index.js";

afterAll(async () => {
  await prisma.$disconnect();
});

function pendingToken(userId: number): string {
  return jwt.sign({ userId, isMfaPending: true }, env.JWT_SECRET, { expiresIn: "10m" });
}

function accessToken(userId: number, userTypeId: number, email: string): string {
  return jwt.sign({ userId, userTypeId, email }, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("confirmMfaSetup / verifyMfa (service)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejette un token MFA invalide ou expiré", async () => {
    await expect(confirmMfaSetup("not-a-jwt", "123456")).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(verifyMfa("not-a-jwt", "123456")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejette un token JWT final (non pending) sur confirm-setup", async () => {
    const user = await createUser({ mfaSecret: createMfaSecret(), mfaEnabled: false });
    const finalToken = accessToken(user.id, 2, user.email);

    await expect(confirmMfaSetup(finalToken, "123456")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("setPassword échoue si le compte n'a pas été invité", async () => {
    await expect(setPassword("inconnu@connecteo.mg", "Password123!")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("verifyMfa échoue si le MFA n'est pas activé sur le compte", async () => {
    const user = await createUser({ mfaSecret: createMfaSecret(), mfaEnabled: false });

    await expect(verifyMfa(pendingToken(user.id), "123456")).rejects.toBeInstanceOf(BadRequestError);
  });

  it("confirmMfaSetup rejette un code invalide mais active avec un code valide", async () => {
    const user = await createUser({ mfaSecret: createMfaSecret(), mfaEnabled: false });
    const token = pendingToken(user.id);

    await expect(confirmMfaSetup(token, "000000")).rejects.toBeInstanceOf(UnauthorizedError);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.mfa_enabled).toBe(false);

    const code = await totpCodeFor(user.id);
    const result = await confirmMfaSetup(token, code);

    expect(result.token).toBeTruthy();
    expect(result.user.mfa_enabled).toBe(true);
    expect(result.user.mfa_secret).toBeUndefined();
  });

  it("confirmMfaSetup refuse d'activer deux fois", async () => {
    const user = await createUser({ mfaSecret: createMfaSecret(), mfaEnabled: true });

    await expect(confirmMfaSetup(pendingToken(user.id), "123456")).rejects.toBeInstanceOf(BadRequestError);
  });
});
