import { describe, it, expect, beforeEach, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";
import {
  api,
  createUser,
  signToken,
  resetDatabase,
} from "./helpers/auth.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Changement de mot de passe forcé (premier login)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("le endpoint force-change-password fonctionne sans authentification (error 401)", async () => {
    const res = await api
      .post("/api/auth/force-change-password")
      .send({ newPassword: "NewPass123!" });
    expect(res.status).toBe(401);
  });

  it("retourne 400 si newPassword est manquant", async () => {
    const user = await createUser({ userTypeId: 1, password: "OldPass123!" });
    const token = signToken(user.id, 1, user.email);

    const res = await api
      .post("/api/auth/force-change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("newPassword est requis");
  });

  it("refuse si force_password_change est false", async () => {
    const user = await createUser({ userTypeId: 1, password: "OldPass123!" });
    const token = signToken(user.id, 1, user.email);

    const res = await api
      .post("/api/auth/force-change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NewPass123!" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Aucun changement de mot de passe obligatoire en cours");
  });

  it("refuse si le nouveau mot de passe est le même que l'ancien", async () => {
    const user = await createUser({ userTypeId: 1, password: "SamePass123!" });
    await prisma.user.update({
      where: { id: user.id },
      data: { force_password_change: true },
    });
    const token = signToken(user.id, 1, user.email);

    const res = await api
      .post("/api/auth/force-change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "SamePass123!" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le nouveau mot de passe doit être différent de l'ancien");
  });

  it("refuse si le nouveau mot de passe fait moins de 8 caractères", async () => {
    const user = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: user.id },
      data: { force_password_change: true },
    });
    const token = signToken(user.id, 1, user.email);

    const res = await api
      .post("/api/auth/force-change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "Short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Le mot de passe doit contenir au moins 8 caractères");
  });

  it("change le mot de passe, désactive force_password_change et révoque les tokens", async () => {
    const user = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: user.id },
      data: { force_password_change: true },
    });
    const token = signToken(user.id, 1, user.email);

    const res = await api
      .post("/api/auth/force-change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NewPass456!" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Mot de passe modifié avec succès. Veuillez vous reconnecter.");
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.force_password_change).toBe(false);

    const match = await bcrypt.compare("NewPass456!", updated!.password_hash!);
    expect(match).toBe(true);

    const matchOld = await bcrypt.compare("OldPass123!", updated!.password_hash!);
    expect(matchOld).toBe(false);
  });

  it("le token JWT retourné est valide et contient le token_version mis à jour", async () => {
    const user = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: user.id },
      data: { force_password_change: true, token_version: 0 },
    });
    const token = signToken(user.id, 1, user.email);

    const res = await api
      .post("/api/auth/force-change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NewPass456!" });

    expect(res.status).toBe(200);

    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(res.body.token, process.env.JWT_SECRET!) as { userId: number; tokenVersion: number };
    expect(decoded.userId).toBe(user.id);
    expect(decoded.tokenVersion).toBe(1);
  });
});

describe("Middleware forcePasswordChange — blocage des routes admin", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("le middleware forcePasswordChange bloque l'accès aux routes superAdmin si force_password_change est true", async () => {
    const superAdmin = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { force_password_change: true },
    });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const res = await api
      .get("/api/admin")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.forcePasswordChange).toBe(true);
  });

  it("le middleware forcePasswordChange bloque l'invitation admin si force_password_change est true", async () => {
    const superAdmin = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { force_password_change: true },
    });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const res = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "test@test.mg", username: "test-admin" });
    expect(res.status).toBe(403);
    expect(res.body.forcePasswordChange).toBe(true);
  });

  it("le middleware forcePasswordChange bloque l'audit logs si force_password_change est true", async () => {
    const superAdmin = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { force_password_change: true },
    });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const res = await api
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.forcePasswordChange).toBe(true);
  });

  it("l'ancien token est invalidé après changement de mot de passe forcé", async () => {
    const superAdmin = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { force_password_change: true },
    });
    const oldToken = signToken(superAdmin.id, 1, superAdmin.email);

    await api
      .post("/api/auth/force-change-password")
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ newPassword: "NewPass456!" });

    const res = await api
      .get("/api/admin")
      .set("Authorization", `Bearer ${oldToken}`);
    expect(res.status).toBe(401);
  });

  it("n'autorise PAS /admin/me sans auth quand force_password_change est actif", async () => {
    const user = await createUser({ userTypeId: 1, password: "OldPass123!" });
    await prisma.user.update({
      where: { id: user.id },
      data: { force_password_change: true },
    });

    const res = await api.get("/api/admin/me");
    expect(res.status).toBe(401);
  });
});

describe("Login — retour forcePasswordChange", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("retourne forcePasswordChange dans la réponse de login MFA si le flag est actif", async () => {
    const user = await createUser({ userTypeId: 1, password: "TestPass123!", mfaEnabled: true, mfaSecret: "JBSWY3DPEHPK3PXP" });
    await prisma.user.update({
      where: { id: user.id },
      data: { force_password_change: true },
    });

    const res = await api
      .post("/api/admin/login")
      .send({ email: user.email, password: "TestPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.requireMfa).toBe(true);
    expect(res.body.forcePasswordChange).toBe(true);
  });

  it("retourne forcePasswordChange: false dans la réponse de login MFA si le flag n'est pas actif", async () => {
    const user = await createUser({ userTypeId: 1, password: "TestPass123!", mfaEnabled: true, mfaSecret: "JBSWY3DPEHPK3PXP" });

    const res = await api
      .post("/api/admin/login")
      .send({ email: user.email, password: "TestPass123!" });

    expect(res.status).toBe(200);
    expect(res.body.requireMfa).toBe(true);
    expect(res.body.forcePasswordChange).toBe(false);
  });
});
