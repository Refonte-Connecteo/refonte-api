import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";
import { api, createUser, signToken, totpCodeFor, resetDatabase } from "./helpers/auth.js";
import { createMfaSecret, generateTotpCode } from "../src/services/mfa.service.js";
import { assertPasswordPolicy } from "../src/utils/passwordPolicy.js";

afterAll(async () => {
  await prisma.$disconnect();
});

async function createMfaUser(userTypeId = 2) {
  return createUser({ mfaSecret: createMfaSecret(), mfaEnabled: true, userTypeId });
}

async function passwordStep(email: string, password: string) {
  return api.post("/api/auth/login").send({ email, password });
}

describe("Connexion : réponses identiques et verrouillage", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("même réponse pour une adresse inconnue, un compte inactif et un compte en attente", async () => {
    const inactive = await createUser({ isActive: false });
    const pending = await prisma.user.create({
      data: { email: "attente@exemple.test", username: "attente", user_type_id: 2, is_active: false },
    });

    const responses = await Promise.all([
      passwordStep("inconnu@exemple.test", "PeuImporte123!"),
      passwordStep(inactive.email, inactive.password),
      passwordStep(pending.email, "PeuImporte123!"),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Email ou mot de passe incorrect");
    }
  });

  it("l'adresse e-mail est comparée sans tenir compte de la casse", async () => {
    const user = await createMfaUser();
    const res = await passwordStep(`  ${user.email.toUpperCase()} `, user.password);
    expect(res.status).toBe(200);
  });

  it("verrouille le compte après 5 mauvais mots de passe, même avec le bon ensuite", async () => {
    const user = await createMfaUser();
    for (let i = 0; i < 5; i++) {
      expect((await passwordStep(user.email, "MauvaisMotDePasse!")).status).toBe(401);
    }
    const locked = await passwordStep(user.email, user.password);
    expect(locked.status).toBe(429);

    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.locked_until).not.toBeNull();
  });

  it("une connexion réussie remet le compteur d'échecs à zéro", async () => {
    const user = await createMfaUser();
    await passwordStep(user.email, "MauvaisMotDePasse!");
    const login = await passwordStep(user.email, user.password);
    const verify = await api.post("/api/auth/mfa/verify").send({ mfaToken: login.body.mfaToken, code: await totpCodeFor(user.id) });
    expect(verify.status).toBe(200);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.failed_login_count).toBe(0);
  });

  it("les mauvais codes à 6 chiffres comptent aussi dans le verrouillage", async () => {
    const user = await createMfaUser();
    const login = await passwordStep(user.email, user.password);
    for (let i = 0; i < 5; i++) {
      await api.post("/api/auth/mfa/verify").send({ mfaToken: login.body.mfaToken, code: "000000" });
    }
    const res = await api.post("/api/auth/mfa/verify").send({ mfaToken: login.body.mfaToken, code: await totpCodeFor(user.id) });
    expect(res.status).toBe(429);
  });
});

describe("Double authentification : rejeu et jeton à usage unique", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("un code déjà utilisé ne peut pas resservir", async () => {
    const secret = createMfaSecret();
    const user = await createUser({ mfaSecret: secret, mfaEnabled: true });
    const code = generateTotpCode(secret);

    const first = await passwordStep(user.email, user.password);
    expect((await api.post("/api/auth/mfa/verify").send({ mfaToken: first.body.mfaToken, code })).status).toBe(200);

    const second = await passwordStep(user.email, user.password);
    expect((await api.post("/api/auth/mfa/verify").send({ mfaToken: second.body.mfaToken, code })).status).toBe(401);
  });

  it("le jeton intermédiaire (mfaToken) ne sert qu'une fois", async () => {
    const user = await createMfaUser();
    const login = await passwordStep(user.email, user.password);
    const ok = await api.post("/api/auth/mfa/verify").send({ mfaToken: login.body.mfaToken, code: await totpCodeFor(user.id) });
    expect(ok.status).toBe(200);

    const replay = await api.post("/api/auth/mfa/verify").send({ mfaToken: login.body.mfaToken, code: await totpCodeFor(user.id) });
    expect(replay.status).toBe(401);
  });

  it("le secret de double authentification est chiffré en base", async () => {
    const secret = createMfaSecret();
    const user = await createUser({ mfaSecret: secret, mfaEnabled: true });
    const rows = await prisma.$queryRaw<{ mfa_secret: string }[]>`SELECT mfa_secret FROM "user" WHERE id = ${user.id}`;
    expect(rows[0].mfa_secret).not.toBe(secret);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.mfa_secret).toBe(secret);
  });
});

describe("Mots de passe", () => {
  it("refuse les mots de passe trop courts, trop longs, courants ou reprenant l'e-mail", () => {
    expect(() => assertPasswordPolicy("Court1!")).toThrow();
    expect(() => assertPasswordPolicy("a".repeat(73))).toThrow();
    expect(() => assertPasswordPolicy("Password1234")).toThrow();
    expect(() => assertPasswordPolicy("jean.dupont2026!", { email: "jean.dupont@connecteo.mg" })).toThrow();
    expect(() => assertPasswordPolicy("Une phrase de passe solide")).not.toThrow();
  });

  it("le lien d'invitation n'est stocké que sous forme d'empreinte", async () => {
    await resetDatabase();
    const superAdmin = await createMfaUser(1);
    const invite = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${signToken(superAdmin.id, 1, superAdmin.email)}`)
      .send({ email: "Nouveau.Admin@Connecteo.mg", username: "nouvel-admin" });
    expect(invite.status).toBe(201);

    const stored = await prisma.user.findUnique({ where: { email: "nouveau.admin@connecteo.mg" } });
    expect(stored?.invitation_token).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.invitation_token).not.toBe(invite.body.invitation_token);
  });
});

describe("Accès administrateur", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("le rôle est relu en base : un jeton qui se dit superAdmin ne suffit pas", async () => {
    const admin = await createMfaUser(2);
    const forged = signToken(admin.id, 1, admin.email);
    expect((await api.get("/api/admin").set("Authorization", `Bearer ${forged}`)).status).toBe(403);
  });

  it("mot de passe temporaire non changé : les données des candidats restent inaccessibles", async () => {
    const admin = await createMfaUser(2);
    await prisma.user.update({ where: { id: admin.id }, data: { force_password_change: true } });
    const res = await api.get("/api/application").set("Authorization", `Bearer ${signToken(admin.id, 2, admin.email)}`);
    expect(res.status).toBe(403);
    expect(res.body.forcePasswordChange).toBe(true);
  });
});

describe("Formulaires publics", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("champ piège rempli : succès apparent, rien n'est enregistré", async () => {
    const res = await api
      .post("/api/contact-message")
      .send({ first_name: "Robot", last_name: "Spam", email: "spam@exemple.test", message: "Achetez", website: "http://spam.test" });
    expect(res.status).toBe(201);
    expect(await prisma.contact_message.count()).toBe(0);
  });

  it("champ piège vide : envoi normal, et le message est chiffré en base", async () => {
    const res = await api
      .post("/api/contact-message")
      .send({ first_name: "Alex", last_name: "Martin", email: "alex@exemple.test", message: "Bonjour, un projet", website: "" });
    expect(res.status).toBe(201);
    const rows = await prisma.$queryRaw<{ message: string }[]>`SELECT message FROM contact_message`;
    expect(rows[0].message).not.toBe("Bonjour, un projet");
    expect((await prisma.contact_message.findFirst())?.message).toBe("Bonjour, un projet");
  });

  it("la page d'erreur d'upload n'interprète pas un nom de fichier piégé", async () => {
    const res = await api
      .post("/api/upload/cv")
      .set("Accept", "text/html")
      .attach("file", Buffer.from("%PDF-1.4"), { filename: "cv.<svg onload=alert(1)>", contentType: "application/pdf" });
    expect(res.status).toBe(400);
    expect(res.text).not.toContain("<svg");
  });
});
