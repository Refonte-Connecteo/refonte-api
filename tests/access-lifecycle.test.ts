import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";
import {
  api,
  createUser,
  signToken,
  totpCodeFor,
  resetDatabase,
} from "./helpers/auth.js";
import { createMfaSecret } from "../src/services/mfa.service.js";

const ADMIN_PASSWORD = "SuperPassword123!";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Cycle de vie des accès — invitation tokenisée", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("crée un compte avec un token d'invitation de 64 caractères, expirant à 72 h", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const res = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "invite@connecteo.mg", username: "invite-admin" });

    expect(res.status).toBe(201);
    expect(res.body.invitation_token).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.user.invitation_token).toBeUndefined();
    expect(res.body.user.invitation_token_expires).toBeUndefined();

    const stored = await prisma.user.findUnique({ where: { email: "invite@connecteo.mg" } });
    expect(stored?.invitation_token).toBe(res.body.invitation_token);
    expect(stored?.invitation_token_expires).not.toBeNull();
    const ttl = stored!.invitation_token_expires!.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(71 * 60 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(72 * 60 * 60 * 1000);
  });

  it("refuse de définir un mot de passe sans token ou avec un token erroné", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const sToken = signToken(superAdmin.id, 1, superAdmin.email);

    const inviteRes = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${sToken}`)
      .send({ email: "sans-token@connecteo.mg", username: "sans-token" });
    expect(inviteRes.status).toBe(201);

    const sansToken = await api
      .post("/api/admin/set-password")
      .send({ email: "sans-token@connecteo.mg", password: ADMIN_PASSWORD });
    expect(sansToken.status).toBe(400);

    const mauvaisToken = await api
      .post("/api/admin/set-password")
      .send({ email: "sans-token@connecteo.mg", password: ADMIN_PASSWORD, invitationToken: "0".repeat(64) });
    expect(mauvaisToken.status).toBe(401);

    const stored = await prisma.user.findUnique({ where: { email: "sans-token@connecteo.mg" } });
    expect(stored?.password_hash).toBeNull();
    expect(stored?.is_active).toBe(false);
  });

  it("invalide le token après activation (impossible de réutiliser le lien)", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const sToken = signToken(superAdmin.id, 1, superAdmin.email);

    const inviteRes = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${sToken}`)
      .send({ email: "reuse@connecteo.mg", username: "reuse" });
    const invitationToken = inviteRes.body.invitation_token as string;

    const ok = await api
      .post("/api/admin/set-password")
      .send({ email: "reuse@connecteo.mg", password: ADMIN_PASSWORD, invitationToken });
    expect(ok.status).toBe(201);

    const stored = await prisma.user.findUnique({ where: { email: "reuse@connecteo.mg" } });
    expect(stored?.invitation_token).toBeNull();
    expect(stored?.invitation_token_expires).toBeNull();

    const reuse = await api
      .post("/api/admin/set-password")
      .send({ email: "reuse@connecteo.mg", password: "AutreMdp123!", invitationToken });
    expect(reuse.status).toBe(400);
  });

  it("refuse un token d'invitation expiré (set-password et check-pending)", async () => {
    const expired = new Date(Date.now() - 60 * 1000);
    const user = await prisma.user.create({
      data: {
        email: "expire@connecteo.mg",
        username: "expire",
        password_hash: null,
        user_type_id: 2,
        is_active: false,
        invitation_token: "a".repeat(64),
        invitation_token_expires: expired,
      },
    });

    const res = await api
      .post("/api/admin/set-password")
      .send({ email: "expire@connecteo.mg", password: ADMIN_PASSWORD, invitationToken: "a".repeat(64) });
    expect(res.status).toBe(401);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.password_hash).toBeNull();

    const pending = await api.post("/api/admin/check-pending").send({ email: "expire@connecteo.mg" });
    expect(pending.status).toBe(400);
  });

  it("journalise le refus d'activation comme PASSWORD_SET en échec", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const sToken = signToken(superAdmin.id, 1, superAdmin.email);

    const inviteRes = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${sToken}`)
      .send({ email: "audit-invite@connecteo.mg", username: "audit-invite" });

    await api
      .post("/api/admin/set-password")
      .send({ email: "audit-invite@connecteo.mg", password: ADMIN_PASSWORD, invitationToken: inviteRes.body.invitation_token });
    const fail = await api
      .post("/api/admin/set-password")
      .send({ email: "audit-invite@connecteo.mg", password: ADMIN_PASSWORD, invitationToken: inviteRes.body.invitation_token });

    expect(fail.status).toBe(400);
    const failedLog = await prisma.audit_log.findFirst({
      where: { event_type: "PASSWORD_SET", success: false },
    });
    expect(failedLog).not.toBeNull();
  });
});

describe("Cycle de vie des accès — protection du superAdmin", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("interdit au superAdmin de désactiver ou supprimer son propre compte", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const deactivate = await api
      .delete(`/api/admin/${superAdmin.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(deactivate.status).toBe(403);

    const remove = await api
      .delete(`/api/admin/${superAdmin.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(remove.status).toBe(403);
  });

  it("permet la désactivation d'un autre admin et bloque l'accès ensuite", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const target = await createUser({ userTypeId: 2 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const res = await api
      .delete(`/api/admin/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const targetToken = signToken(target.id, 2, target.email);
    const blocked = await api.get("/api/admin/me").set("Authorization", `Bearer ${targetToken}`);
    expect(blocked.status).toBe(401);
  });
});

describe("Cycle de vie des accès — dernière connexion", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("renseigne last_login_at après la vérification MFA", async () => {
    const user = await createUser({ mfaEnabled: true, mfaSecret: createMfaSecret() });

    const loginRes = await api
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    expect(loginRes.body.requireMfa).toBe(true);

    const storedBefore = await prisma.user.findUnique({ where: { id: user.id } });
    expect(storedBefore?.last_login_at).toBeNull();

    const code = await totpCodeFor(user.id);
    const verifyRes = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: loginRes.body.mfaToken, code });

    expect(verifyRes.status).toBe(200);
    const storedAfter = await prisma.user.findUnique({ where: { id: user.id } });
    expect(storedAfter?.last_login_at).not.toBeNull();
  });
});
