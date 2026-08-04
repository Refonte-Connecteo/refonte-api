import { describe, it, expect, beforeEach, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma.js";
import { api, createUser, signToken, totpCodeFor, resetDatabase } from "./helpers/auth.js";
import { createMfaSecret } from "../src/services/mfa.service.js";
import { env } from "../src/config/env.config.js";

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
  return verifyRes.body as { token: string; refreshToken: string; user: { id: number } };
}

async function createMfaUser() {
  return createUser({ mfaSecret: createMfaSecret(), mfaEnabled: true });
}

describe("Sécurité des tokens — durée de vie", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("émet un access token qui expire en 5 minutes maximum", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const decoded = jwt.decode(token) as { iat: number; exp: number; tokenType: string };
    expect(decoded.tokenType).toBe("access");
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(300);
  });

  it("rejette un access token expiré", async () => {
    const user = await createUser();
    const expired = signToken(user.id, 2, user.email);

    const expiredPayload = jwt.sign(
      { userId: user.id, userTypeId: 2, email: user.email, tokenVersion: 0, tokenType: "access" },
      env.JWT_SECRET,
      { expiresIn: "-10s" },
    );

    const meRes = await api.get("/api/admin/me").set("Authorization", `Bearer ${expiredPayload}`);
    expect(meRes.status).toBe(401);
    void expired;
  });
});

describe("Sécurité des tokens — révocation et refresh", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejette un token après déconnexion via /auth/logout", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const before = await api.get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    expect(before.status).toBe(200);

    const logoutRes = await api.post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(logoutRes.status).toBe(200);

    const after = await api.get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it("rejette un refresh token déjà utilisé (rotation)", async () => {
    const user = await createMfaUser();
    const { refreshToken } = await loginViaApi(user.email, user.password);

    const firstRefresh = await api.post("/api/auth/refresh").send({ refreshToken });
    expect(firstRefresh.status).toBe(200);
    expect(firstRefresh.body.token).toBeTruthy();
    expect(firstRefresh.body.refreshToken).toBeTruthy();

    const secondRefresh = await api.post("/api/auth/refresh").send({ refreshToken });
    expect(secondRefresh.status).toBe(401);

    const meRes = await api
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${firstRefresh.body.token}`);
    expect(meRes.status).toBe(200);
  });

  it("révoque tous les tokens lors du changement de mot de passe", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const changeRes = await api
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: user.password, newPassword: "NouveauPass123!" });

    expect(changeRes.status).toBe(200);

    const after = await api.get("/api/admin/me").set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.token_version).toBe(1);
  });
});

describe("Sécurité des tokens — réauthentification des opérations sensibles", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("refuse /auth/change-password sans le mot de passe actuel", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const missing = await api
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NouveauPass123!" });
    expect(missing.status).toBe(400);

    const wrong = await api
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "MauvaisMotDePasse", newPassword: "NouveauPass123!" });
    expect(wrong.status).toBe(401);
  });

  it("refuse /auth/mfa/disable sans le mot de passe actuel", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const missing = await api
      .post("/api/auth/mfa/disable")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(missing.status).toBe(400);

    const wrong = await api
      .post("/api/auth/mfa/disable")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "MauvaisMotDePasse" });
    expect(wrong.status).toBe(401);
  });

  it("désactive le MFA avec le mot de passe actuel correct", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const disableRes = await api
      .post("/api/auth/mfa/disable")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: user.password });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.user.mfa_enabled).toBe(false);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.mfa_enabled).toBe(false);
    expect(stored?.mfa_secret).toBeNull();
  });

  it("change le mot de passe avec le mot de passe actuel correct, puis bloque l'ancien", async () => {
    const user = await createMfaUser();
    const { token } = await loginViaApi(user.email, user.password);

    const changeRes = await api
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: user.password, newPassword: "NouveauPass123!" });
    expect(changeRes.status).toBe(200);

    const oldLogin = await api.post("/api/auth/login").send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api.post("/api/auth/login").send({ email: user.email, password: "NouveauPass123!" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.requireMfa).toBe(true);
  });

  it("rejette un token de rafraîchissement présenté comme access token", async () => {
    const user = await createMfaUser();
    const { refreshToken } = await loginViaApi(user.email, user.password);

    const meRes = await api.get("/api/admin/me").set("Authorization", `Bearer ${refreshToken}`);
    expect(meRes.status).toBe(401);
  });
});
