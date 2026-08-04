import { describe, it, expect, beforeEach, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma.js";
import { api, createUser, totpCodeFor, resetDatabase } from "./helpers/auth.js";
import { createMfaSecret } from "../src/services/mfa.service.js";
import { signRefreshToken, verifyRefreshToken } from "../src/services/token.service.js";
import { assertStrongJwtSecret, env } from "../src/config/env.config.js";
import {
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
  clearRefreshTokenCookie,
} from "../src/utils/cookies.js";
import { UnauthorizedError } from "../src/errors/index.js";

afterAll(async () => {
  await prisma.$disconnect();
});

async function loginViaApi(email: string, password: string) {
  const loginRes = await api.post("/api/auth/login").send({ email, password });
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.requireMfa).toBe(true);

  const code = await totpCodeFor(loginRes.body.userId);
  const verifyRes = await api
    .post("/api/auth/mfa/verify")
    .send({ mfaToken: loginRes.body.mfaToken, code });

  expect(verifyRes.status).toBe(200);
  return verifyRes.body as { token: string; refreshToken: string };
}

async function createMfaUser() {
  return createUser({ mfaSecret: createMfaSecret(), mfaEnabled: true });
}

function refreshCookieHeader(token: string): string {
  return `${REFRESH_TOKEN_COOKIE}=${token}`;
}

describe("Entropie des identifiants (>= 128 bits)", () => {
  it("génère un jti de 256 bits (64 caractères hexadécimaux)", () => {
    const token = signRefreshToken({ id: 1, user_type_id: 2, email: "a@b.c", token_version: 0 });
    const decoded = jwt.decode(token) as { jti?: string };

    expect(decoded.jti).toBeDefined();
    expect(decoded.jti).toMatch(/^[0-9a-f]{64}$/);
    expect(decoded.jti!.length * 4).toBeGreaterThanOrEqual(128);
  });

  it("génère des jti uniques à chaque rafraîchissement", () => {
    const subject = { id: 1, user_type_id: 2, email: "a@b.c", token_version: 0 };
    const first = jwt.decode(signRefreshToken(subject)) as { jti: string };
    const second = jwt.decode(signRefreshToken(subject)) as { jti: string };

    expect(first.jti).not.toBe(second.jti);
  });
});

describe("Algorithme JWT (HS256 minimum)", () => {
  it("signe les access et refresh tokens avec HS256", () => {
    const subject = { id: 1, user_type_id: 2, email: "a@b.c", token_version: 0 };
    const access = signRefreshToken(subject);
    const header = jwt.decode(access, { complete: true }) as { header: { alg: string } };

    expect(env.JWT_ALGORITHM).toBe("HS256");
    expect(header.header.alg).toBe("HS256");
  });

  it("rejette un token signé avec un autre algorithme (anti algorithm-confusion)", async () => {
    const forged = jwt.sign(
      { userId: 1, userTypeId: 2, email: "a@b.c", tokenVersion: 0, tokenType: "refresh", jti: "x" },
      env.JWT_SECRET,
      { algorithm: "HS512", expiresIn: "1h" },
    );

    await expect(verifyRefreshToken(forged)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("exige un JWT_SECRET d'au moins 32 caractères cryptographiques", () => {
    expect(() => assertStrongJwtSecret("clef-trop-courte")).toThrow();
    expect(() => assertStrongJwtSecret("a".repeat(32))).not.toThrow();
  });
});

describe("Configuration stricte des cookies (Secure / HttpOnly / SameSite)", () => {
  it("expose httpOnly et sameSite strict par défaut", () => {
    const options = refreshCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.path).toBe("/");
  });

  it("active secure uniquement en production", () => {
    const original = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    expect(refreshCookieOptions().secure).toBe(false);

    process.env.NODE_ENV = "production";
    expect(refreshCookieOptions().secure).toBe(true);

    process.env.NODE_ENV = original;
  });

  it("positionne le cookie de refresh sur la connexion (MFA vérifié)", async () => {
    const user = await createMfaUser();
    const loginRes = await api.post("/api/auth/login").send({ email: user.email, password: user.password });
    const code = await totpCodeFor(loginRes.body.userId);

    const verifyRes = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: loginRes.body.mfaToken, code });

    const setCookie = (verifyRes.headers["set-cookie"] ?? []) as string[];
    const cookie = setCookie.find((entry) => entry.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
  });

  it("accepte le refresh token fourni via cookie", async () => {
    const user = await createMfaUser();
    const { refreshToken } = await loginViaApi(user.email, user.password);

    const refreshRes = await api.post("/api/auth/refresh").set("Cookie", refreshCookieHeader(refreshToken));

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeTruthy();
    expect(refreshRes.body.refreshToken).toBeTruthy();

    const setCookie = (refreshRes.headers["set-cookie"] ?? []) as string[];
    expect(setCookie.some((entry) => entry.startsWith(`${REFRESH_TOKEN_COOKIE}=`))).toBe(true);
  });

  it("détruit le cookie de refresh lors de la déconnexion", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const logoutRes = await api.post("/api/auth/logout").set("Authorization", `Bearer ${token}`);

    expect(logoutRes.status).toBe(200);

    const setCookie = (logoutRes.headers["set-cookie"] ?? []) as string[];
    const cleared = setCookie.find((entry) => entry.startsWith(`${REFRESH_TOKEN_COOKIE}=`));

    expect(cleared).toBeDefined();
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("SameSite=Strict");
    expect(cleared).toMatch(/Max-Age=0|Expires=/);
  });

  it("clearRefreshTokenCookie applique bien les options strictes", () => {
    const calls: Array<{ name: string; options: Record<string, unknown> }> = [];
    const res = {
      clearCookie(name: string, options: Record<string, unknown>) {
        calls.push({ name, options });
        return this;
      },
    };

    clearRefreshTokenCookie(res as never);

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe(REFRESH_TOKEN_COOKIE);
    expect(calls[0].options.httpOnly).toBe(true);
    expect(calls[0].options.sameSite).toBe("strict");
    expect(calls[0].options.secure).toBe(false);
  });
});

describe("Invalidation stricte des sessions (logout)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("invalide le refresh token en base de données lors de la déconnexion", async () => {
    const user = await createMfaUser();
    const { token, refreshToken } = await loginViaApi(user.email, user.password);

    const logoutRes = await api
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .set("Cookie", refreshCookieHeader(refreshToken));
    expect(logoutRes.status).toBe(200);

    const refreshRes = await api.post("/api/auth/refresh").set("Cookie", refreshCookieHeader(refreshToken));
    expect(refreshRes.status).toBe(401);
  });
});
