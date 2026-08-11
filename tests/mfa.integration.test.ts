import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";
import {
  api,
  createUser,
  signToken,
  totpCodeFor,
  resetDatabase,
} from "./helpers/auth.js";
import { MFA_ISSUER } from "../src/services/mfa.service.js";

const ADMIN_PASSWORD = "SuperPassword123!";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("MFA integration — registration & onboarding obligatoire", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("flux complet : invitation -> set-password (QR) -> confirm-setup -> login MFA -> verify", async () => {
    const superAdmin = await createUser({ email: "superadmin@connecteo.mg", username: "superadmin", userTypeId: 1 });
    const superAdminToken = signToken(superAdmin.id, 1, superAdmin.email);

    // 1. SuperAdmin invite un admin
    const inviteRes = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ email: "invited@connecteo.mg", username: "invited-admin" });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.user.mfa_secret).toBeUndefined();
    expect(inviteRes.body.user.password_hash).toBeUndefined();
    const invitationToken = inviteRes.body.invitation_token as string;
    expect(invitationToken).toBeTruthy();

    // 2. Compte en attente
    const pendingRes = await api
      .post("/api/admin/check-pending")
      .send({ email: "invited@connecteo.mg" });

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.user.email).toBe("invited@connecteo.mg");
    expect(pendingRes.body.user.is_active).toBe(false);

    // 3. Validation de l'invitation = création du compte avec onboarding MFA obligatoire
    const setupRes = await api
      .post("/api/admin/set-password")
      .send({ email: "invited@connecteo.mg", password: ADMIN_PASSWORD, invitationToken });

    expect(setupRes.status).toBe(201);
    expect(setupRes.body.requireMfaSetup).toBe(true);
    expect(setupRes.body.mfaToken).toBeTruthy();
    expect(setupRes.body.userId).toBeGreaterThan(0);
    expect(setupRes.body.email).toBe("invited@connecteo.mg");

    const { mfaToken: setupToken, userId, otpauthUrl, qrCodeDataUrl } = setupRes.body;

    // URI compatible Microsoft Authenticator (TOTP / RFC 6238)
    expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(otpauthUrl).toContain(`${MFA_ISSUER}:invited%40connecteo.mg`);
    expect(otpauthUrl).toContain(`issuer=${MFA_ISSUER}`);
    expect(otpauthUrl).toContain("secret=");

    // QR Code en DataURI PNG
    expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    // Secret sauvegardé en BDD avec mfa_enabled = false
    const storedUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(storedUser?.mfa_secret).toBeTruthy();
    expect(storedUser?.mfa_enabled).toBe(false);
    expect(storedUser?.password_hash).not.toBeNull();
    expect(storedUser?.is_active).toBe(true);

    // 4. L'utilisateur NE PEUT PAS se connecter tant que le MFA n'est pas confirmé
    const earlyLogin = await api
      .post("/api/admin/login")
      .send({ email: "invited@connecteo.mg", password: ADMIN_PASSWORD });

    expect(earlyLogin.status).toBe(200);
    expect(earlyLogin.body.requireMfaSetup).toBe(true);
    expect(earlyLogin.body.token).toBeUndefined();
    expect(earlyLogin.body.otpauthUrl).toBe(otpauthUrl);

    // 5. Code invalide -> rejet
    const badConfirm = await api
      .post("/api/admin/mfa/confirm-setup")
      .send({ mfaToken: setupToken, code: "000000" });

    expect(badConfirm.status).toBe(401);
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.mfa_enabled).toBe(false);

    // 6. Code valide -> MFA activé + JWT final
    const validCode = await totpCodeFor(userId);
    const confirmRes = await api
      .post("/api/admin/mfa/confirm-setup")
      .send({ mfaToken: setupToken, code: validCode });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.token).toBeTruthy();
    expect(confirmRes.body.user.mfa_enabled).toBe(true);
    expect(confirmRes.body.user.mfa_secret).toBeUndefined();
    expect((await prisma.user.findUnique({ where: { id: userId } }))?.mfa_enabled).toBe(true);

    // 7. Un token MFA "pending" ne permet pas d'accéder aux routes protégées
    const pendingRejected = await api
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${setupToken}`);

    expect(pendingRejected.status).toBe(401);

    // 8. Le JWT final fonctionne
    const meRes = await api
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${confirmRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("invited@connecteo.mg");
    expect(meRes.body.user.mfa_secret).toBeUndefined();
    expect(meRes.body.user.password_hash).toBeUndefined();

    // 9. Connexion ultérieure -> requireMfa
    const loginRes = await api
      .post("/api/admin/login")
      .send({ email: "invited@connecteo.mg", password: ADMIN_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requireMfa).toBe(true);
    expect(loginRes.body.requireMfaSetup).toBeUndefined();
    expect(loginRes.body.token).toBeUndefined();
    expect(loginRes.body.mfaToken).toBeTruthy();
    expect(loginRes.body.userId).toBe(userId);

    // 10. verify avec mauvais code -> 401
    const badVerify = await api
      .post("/api/admin/mfa/verify")
      .send({ mfaToken: loginRes.body.mfaToken, code: "000000" });

    expect(badVerify.status).toBe(401);

    // 11. verify avec le bon code Microsoft Authenticator -> JWT final
    const freshCode = await totpCodeFor(userId);
    const verifyRes = await api
      .post("/api/admin/mfa/verify")
      .send({ mfaToken: loginRes.body.mfaToken, code: freshCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeTruthy();
    expect(verifyRes.body.user.mfa_secret).toBeUndefined();

    const verifiedMe = await api
      .get("/api/admin/me")
      .set("Authorization", `Bearer ${verifyRes.body.token}`);

    expect(verifiedMe.status).toBe(200);
    expect(verifiedMe.body.user.email).toBe("invited@connecteo.mg");
  });

  it("force l'onboarding MFA pour un compte sans aucune configuration MFA", async () => {
    const user = await createUser({ email: "nouveau@connecteo.mg", username: "nouveau" });

    const loginRes = await api
      .post("/api/admin/login")
      .send({ email: user.email, password: user.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requireMfaSetup).toBe(true);
    expect(loginRes.body.token).toBeUndefined();
    expect(loginRes.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.mfa_secret).toBeTruthy();
    expect(stored?.mfa_enabled).toBe(false);
  });

  it("rejette les requêtes confirm-setup / verify malformées", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const inviteRes = await api.post("/api/admin/invite").set("Authorization", `Bearer ${token}`).send({
      email: "bad@connecteo.mg",
      username: "bad-user",
    });
    const inviteToken = inviteRes.body.invitation_token as string;
    await api.post("/api/admin/set-password").send({ email: "bad@connecteo.mg", password: ADMIN_PASSWORD, invitationToken: inviteToken });

    const missing = await api.post("/api/admin/mfa/confirm-setup").send({ mfaToken: "xxx" });
    expect(missing.status).toBe(400);

    const badCode = await api.post("/api/admin/mfa/confirm-setup").send({ mfaToken: "xxx", code: "12345" });
    expect(badCode.status).toBe(400);

    const badVerify = await api.post("/api/admin/mfa/verify").send({ code: "123456" });
    expect(badVerify.status).toBe(400);
  });

  it("expose les mêmes endpoints sous /api/auth/* (spec)", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const superAdminToken = signToken(superAdmin.id, 1, superAdmin.email);

    const inviteRes = await api.post("/api/admin/invite").set("Authorization", `Bearer ${superAdminToken}`).send({
      email: "alias@connecteo.mg",
      username: "alias-user",
    });

    const setupRes = await api
      .post("/api/admin/set-password")
      .send({ email: "alias@connecteo.mg", password: ADMIN_PASSWORD, invitationToken: inviteRes.body.invitation_token });

    const userId = setupRes.body.userId as number;
    const code = await totpCodeFor(userId);

    const confirmRes = await api
      .post("/api/auth/mfa/confirm-setup")
      .send({ mfaToken: setupRes.body.mfaToken, code });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.token).toBeTruthy();

    const loginRes = await api
      .post("/api/auth/login")
      .send({ email: "alias@connecteo.mg", password: ADMIN_PASSWORD });

    expect(loginRes.body.requireMfa).toBe(true);

    const freshCode = await totpCodeFor(userId);
    const verifyRes = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: loginRes.body.mfaToken, code: freshCode });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeTruthy();
  });

  it("n'expose jamais mfa_secret dans la liste des admins", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const inviteRes = await api.post("/api/admin/invite").set("Authorization", `Bearer ${token}`).send({
      email: "list@connecteo.mg",
      username: "list-user",
    });
    await api.post("/api/admin/set-password").send({ email: "list@connecteo.mg", password: ADMIN_PASSWORD, invitationToken: inviteRes.body.invitation_token });

    const listRes = await api.get("/api/admin").set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);

    const body = JSON.stringify(listRes.body);
    expect(body).not.toContain("mfa_secret");
    expect(body).not.toContain("password_hash");
  });
});
