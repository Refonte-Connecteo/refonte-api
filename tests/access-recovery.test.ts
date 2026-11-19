import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";
import { api, createUser, totpCodeFor, resetDatabase, signToken } from "./helpers/auth.js";
import {
  createMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryCodeFormat,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "../src/services/mfa.service.js";

afterAll(async () => {
  await prisma.$disconnect();
});

async function createMfaUser(userTypeId = 2) {
  return createUser({ mfaSecret: createMfaSecret(), mfaEnabled: true, userTypeId });
}

async function loginViaApi(email: string, password: string) {
  const loginRes = await api.post("/api/auth/login").send({ email, password });
  expect(loginRes.status).toBe(200);
  const code = await totpCodeFor(loginRes.body.userId);
  const verifyRes = await api.post("/api/auth/mfa/verify").send({ mfaToken: loginRes.body.mfaToken, code });
  expect(verifyRes.status).toBe(200);
  return verifyRes.body as { token: string; refreshToken: string };
}

/** Ouvre une session « en attente du MFA » et renvoie son mfaToken. */
async function mfaTokenFor(email: string, password: string): Promise<string> {
  const res = await api.post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body.requireMfa).toBe(true);
  return res.body.mfaToken as string;
}

async function giveRecoveryCodes(userId: number): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await prisma.user.update({ where: { id: userId }, data: { mfa_recovery_codes: codes.map(hashRecoveryCode) } });
  return codes;
}

describe("Codes de secours : génération", () => {
  it("produit 10 codes distincts au format XXXX-XXXX, sans caractères ambigus", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      expect(isRecoveryCodeFormat(code)).toBe(true);
    }
  });

  it("accepte minuscules et espaces, mais pas un code TOTP ni un texte trop long", () => {
    const [code] = generateRecoveryCodes();
    expect(normalizeRecoveryCode(` ${code.toLowerCase()} `)).toBe(code.replace("-", ""));
    expect(hashRecoveryCode(code.toLowerCase())).toBe(hashRecoveryCode(code));
    expect(isRecoveryCodeFormat("123456")).toBe(false);
    expect(isRecoveryCodeFormat("A".repeat(50))).toBe(false);
  });
});

describe("Codes de secours : activation du MFA", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("renvoie 10 codes une seule fois et n'en stocke que l'empreinte", async () => {
    const user = await createUser({ mfaSecret: createMfaSecret(), mfaEnabled: false });
    const loginRes = await api.post("/api/auth/login").send({ email: user.email, password: user.password });
    expect(loginRes.body.requireMfaSetup).toBe(true);

    const code = await totpCodeFor(user.id);
    const res = await api.post("/api/auth/mfa/confirm-setup").send({ mfaToken: loginRes.body.mfaToken, code });
    expect(res.status).toBe(200);
    expect(res.body.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.mfa_recovery_codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(stored?.mfa_recovery_codes).not.toContain(res.body.recoveryCodes[0]);
    expect(stored?.mfa_recovery_codes).toContain(hashRecoveryCode(res.body.recoveryCodes[0]));
    expect(JSON.stringify(res.body.user)).not.toContain("mfa_recovery_codes");
  });
});

describe("Codes de secours : connexion sans téléphone", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("connecte avec un code de secours, une seule fois", async () => {
    const user = await createMfaUser();
    const [first] = await giveRecoveryCodes(user.id);

    const ok = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: await mfaTokenFor(user.email, user.password), recoveryCode: first.toLowerCase() });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.body.remainingRecoveryCodes).toBe(RECOVERY_CODE_COUNT - 1);

    const reused = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: await mfaTokenFor(user.email, user.password), recoveryCode: first });
    expect(reused.status).toBe(401);
  });

  it("refuse un code inconnu ou mal formé", async () => {
    const user = await createMfaUser();
    await giveRecoveryCodes(user.id);
    const mfaToken = await mfaTokenFor(user.email, user.password);

    expect((await api.post("/api/auth/mfa/verify").send({ mfaToken, recoveryCode: "ABCD-EFGH" })).status).toBe(401);
    expect((await api.post("/api/auth/mfa/verify").send({ mfaToken, recoveryCode: "pas-un-code" })).status).toBe(400);
  });

  it("un code d'un autre compte ne fonctionne pas", async () => {
    const alice = await createMfaUser();
    const bob = await createMfaUser();
    const [bobCode] = await giveRecoveryCodes(bob.id);
    await giveRecoveryCodes(alice.id);

    const res = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: await mfaTokenFor(alice.email, alice.password), recoveryCode: bobCode });
    expect(res.status).toBe(401);
  });
});

describe("Codes de secours : nombre restant dans le profil", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("indique combien il en reste, sans jamais renvoyer les codes", async () => {
    const user = await createMfaUser();
    const [first] = await giveRecoveryCodes(user.id);
    const ok = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: await mfaTokenFor(user.email, user.password), recoveryCode: first });
    expect(ok.status).toBe(200);

    const me = await api.get("/api/admin/me").set("Authorization", `Bearer ${ok.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.recovery_codes_remaining).toBe(RECOVERY_CODE_COUNT - 1);
    expect(me.body.user).not.toHaveProperty("mfa_recovery_codes");
  });
});

describe("Codes de secours : régénération depuis le profil", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("exige le mot de passe et invalide les anciens codes", async () => {
    const user = await createMfaUser();
    const [oldCode] = await giveRecoveryCodes(user.id);
    const { token } = await loginViaApi(user.email, user.password);

    const refused = await api
      .post("/api/auth/mfa/recovery-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "mauvais-mot-de-passe" });
    expect(refused.status).toBe(401);

    const res = await api
      .post("/api/auth/mfa/recovery-codes")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: user.password });
    expect(res.status).toBe(200);
    expect(res.body.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);

    const old = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: await mfaTokenFor(user.email, user.password), recoveryCode: oldCode });
    expect(old.status).toBe(401);
  });
});

describe("Réinitialisation de l'accès d'un admin par le super administrateur", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function superAdminToken() {
    const superAdmin = await createMfaUser(1);
    return signToken(superAdmin.id, 1, superAdmin.email);
  }

  it("coupe les sessions, efface mot de passe et MFA, et émet un lien d'1 h", async () => {
    const admin = await createMfaUser();
    await giveRecoveryCodes(admin.id);
    const session = await loginViaApi(admin.email, admin.password);

    const res = await api
      .post(`/api/admin/${admin.id}/reset-access`)
      .set("Authorization", `Bearer ${await superAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.reset_token).toMatch(/^[0-9a-f]{64}$/);
    const ttl = new Date(res.body.reset_token_expires).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(55 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000);

    // Anciennes sessions et ancien mot de passe : inutilisables.
    expect((await api.get("/api/admin/me").set("Authorization", `Bearer ${session.token}`)).status).toBe(401);
    expect((await api.post("/api/auth/refresh").send({ refreshToken: session.refreshToken })).status).toBe(401);
    expect((await api.post("/api/auth/login").send({ email: admin.email, password: admin.password })).status).not.toBe(200);

    const stored = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(stored?.password_hash).toBeNull();
    expect(stored?.mfa_secret).toBeNull();
    expect(stored?.mfa_enabled).toBe(false);
    expect(stored?.mfa_recovery_codes).toEqual([]);

    const audit = await prisma.audit_log.findFirst({ where: { event_type: "ADMIN_ACCESS_RESET" } });
    expect(audit?.resource_id).toBe(String(admin.id));
  });

  it("le lien permet de choisir un nouveau mot de passe puis impose un nouveau MFA, une seule fois", async () => {
    const admin = await createMfaUser();
    const res = await api
      .post(`/api/admin/${admin.id}/reset-access`)
      .set("Authorization", `Bearer ${await superAdminToken()}`);

    const setRes = await api
      .post("/api/admin/set-password")
      .send({ email: admin.email, password: "NouveauMotDePasse!2026", invitationToken: res.body.reset_token });
    expect(setRes.status).toBe(200);
    expect(setRes.body.requireMfaSetup).toBe(true);

    const again = await api
      .post("/api/admin/set-password")
      .send({ email: admin.email, password: "EncoreUnAutre!2026", invitationToken: res.body.reset_token });
    expect(again.status).not.toBe(200);
  });

  it("le lien expire au bout d'une heure", async () => {
    const admin = await createMfaUser();
    const res = await api
      .post(`/api/admin/${admin.id}/reset-access`)
      .set("Authorization", `Bearer ${await superAdminToken()}`);
    await prisma.user.update({
      where: { id: admin.id },
      data: { invitation_token_expires: new Date(Date.now() - 1000) },
    });

    const setRes = await api
      .post("/api/admin/set-password")
      .send({ email: admin.email, password: "NouveauMotDePasse!2026", invitationToken: res.body.reset_token });
    expect(setRes.status).toBe(401);
  });

  it("est réservé au super administrateur", async () => {
    const admin = await createMfaUser();
    const other = await createMfaUser();
    const res = await api
      .post(`/api/admin/${admin.id}/reset-access`)
      .set("Authorization", `Bearer ${signToken(other.id, 2, other.email)}`);
    expect(res.status).toBe(403);
  });

  it("refuse son propre compte, un super administrateur et un compte désactivé", async () => {
    const superAdmin = await createMfaUser(1);
    const token = signToken(superAdmin.id, 1, superAdmin.email);
    const otherSuper = await createMfaUser(1);
    const disabled = await createUser({ isActive: false });

    const self = await api.post(`/api/admin/${superAdmin.id}/reset-access`).set("Authorization", `Bearer ${token}`);
    expect(self.status).toBe(403);
    const sup = await api.post(`/api/admin/${otherSuper.id}/reset-access`).set("Authorization", `Bearer ${token}`);
    expect(sup.status).toBe(400);
    const off = await api.post(`/api/admin/${disabled.id}/reset-access`).set("Authorization", `Bearer ${token}`);
    expect(off.status).toBe(400);
  });
});
