import { describe, it, expect, beforeEach, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";
import { api, createUser, totpCodeFor, signToken, resetDatabase } from "./helpers/auth.js";
import { createMfaSecret } from "../src/services/mfa.service.js";
import {
  logAuditEvent,
  purgeAuditLogs,
  AuditEventType,
} from "../src/services/audit.service.js";

afterAll(async () => {
  await prisma.$disconnect();
});

async function auditCount(where: Record<string, unknown>): Promise<number> {
  return prisma.audit_log.count({ where: where as never });
}

async function mfaLogin(email: string, password: string): Promise<{ token: string }> {
  const loginRes = await api.post("/api/auth/login").send({ email, password });
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.requireMfa).toBe(true);

  const code = await totpCodeFor(loginRes.body.userId);
  const verifyRes = await api
    .post("/api/auth/mfa/verify")
    .send({ mfaToken: loginRes.body.mfaToken, code });

  expect(verifyRes.status).toBe(200);
  return verifyRes.body as { token: string };
}

describe("Piste d'audit — tentatives de connexion", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("journalise un échec de connexion (LOGIN_FAILED) avec l'email et l'IP", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: "inconnu@connecteo.fr", password: "MauvaisMdp123!" });

    expect(res.status).toBe(401);

    const log = await prisma.audit_log.findFirst({
      where: { event_type: AuditEventType.LOGIN_FAILED },
    });

    expect(log).not.toBeNull();
    expect(log!.action).toBe("Tentative de connexion");
    expect(log!.success).toBe(false);
    expect(log!.actor_email).toBe("inconnu@connecteo.fr");
    expect(log!.ip).toBeTruthy();
    expect(log!.route).toContain("/api/auth/login");
  });

  it("journalise un succès de connexion (LOGIN_SUCCESS) et la vérification MFA", async () => {
    const user = await createUser({ mfaSecret: createMfaSecret(), mfaEnabled: true });
    await mfaLogin(user.email, user.password);

    expect(await auditCount({ event_type: AuditEventType.LOGIN_SUCCESS })).toBe(1);
    expect(await auditCount({ event_type: AuditEventType.MFA_VERIFY_SUCCESS })).toBe(1);

    const loginLog = await prisma.audit_log.findFirst({
      where: { event_type: AuditEventType.LOGIN_SUCCESS },
    });
    expect(loginLog!.actor_user_id).toBe(user.id);
    expect(loginLog!.actor_email).toBe(user.email);
  });

  it("journalise un échec de vérification MFA (MFA_VERIFY_FAILED)", async () => {
    const user = await createUser({ mfaSecret: createMfaSecret(), mfaEnabled: true });

    const loginRes = await api.post("/api/auth/login").send({ email: user.email, password: user.password });
    expect(loginRes.status).toBe(200);

    const failRes = await api
      .post("/api/auth/mfa/verify")
      .send({ mfaToken: loginRes.body.mfaToken, code: "000000" });

    expect(failRes.status).toBe(401);
    expect(await auditCount({ event_type: AuditEventType.MFA_VERIFY_FAILED })).toBe(1);
  });
});

describe("Piste d'audit — changements d'accès", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("journalise l'invitation d'un administrateur par le superAdmin", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const res = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "nouvel.admin@connecteo.fr", username: "nouveladmin" });

    expect(res.status).toBe(201);
    expect(await auditCount({ event_type: AuditEventType.ADMIN_INVITED, success: true })).toBe(1);

    const log = await prisma.audit_log.findFirst({
      where: { event_type: AuditEventType.ADMIN_INVITED },
    });
    expect(log!.actor_user_id).toBe(superAdmin.id);
    expect(log!.actor_email).toBe(superAdmin.email);
    expect(log!.resource_type).toBe("user");
  });

  it("journalise la désactivation d'un administrateur", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const target = await createUser({ userTypeId: 2 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const res = await api
      .delete(`/api/admin/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await auditCount({ event_type: AuditEventType.ADMIN_DEACTIVATED, success: true })).toBe(1);
  });
});

describe("Piste d'audit — comptes privilégiés et rejets", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("journalise chaque requête admin (PRIVILEGED_REQUEST)", async () => {
    const admin = await createUser({ userTypeId: 2 });
    const token = signToken(admin.id, 2, admin.email);

    const res = await api
      .post("/api/ceomessage")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Message CEO", description: "Contenu" });

    expect(res.status).toBe(201);
    expect(await auditCount({ event_type: AuditEventType.PRIVILEGED_REQUEST, success: true })).toBe(1);
  });

  it("journalise un refus d'accès privilégié (403) pour un admin simple", async () => {
    const admin = await createUser({ userTypeId: 2 });
    const token = signToken(admin.id, 2, admin.email);

    const res = await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "x@x.fr", username: "y" });

    expect(res.status).toBe(403);
    expect(await auditCount({ event_type: AuditEventType.AUTH_FAILED, success: false, status_code: 403 })).toBe(1);
  });

  it("journalise une tentative d'accès sans token (AUTH_FAILED)", async () => {
    const res = await api.get("/api/admin/me");
    expect(res.status).toBe(401);
    expect(await auditCount({ event_type: AuditEventType.AUTH_FAILED })).toBeGreaterThanOrEqual(1);
  });

  it("journalise le rejet d'un payload XSS (VALIDATION_REJECTED)", async () => {
    const res = await api
      .post("/api/contact-message")
      .send({
        first_name: "Alice",
        last_name: "Doe",
        email: "alice@example.com",
        message: "<script>alert(document.cookie)</script>",
      });

    expect(res.status).toBe(400);
    expect(await auditCount({ event_type: AuditEventType.VALIDATION_REJECTED, success: false })).toBe(1);
  });

  it("journalise le rejet d'une validation express-validator (VALIDATION_REJECTED)", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: "pas-un-email", password: "MotDePasse123!" });

    expect(res.status).toBe(400);
    expect(await auditCount({ event_type: AuditEventType.VALIDATION_REJECTED, success: false })).toBe(1);
  });
});

describe("Piste d'audit — consultation (superAdmin)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("refuse l'accès à la consultation pour un admin simple (403)", async () => {
    const admin = await createUser({ userTypeId: 2 });
    const token = signToken(admin.id, 2, admin.email);

    const res = await api
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("paginate et filtre les événements pour le superAdmin", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "a.audit@connecteo.fr", username: "a1" });
    await api
      .post("/api/admin/invite")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "b.audit@connecteo.fr", username: "b1" });
    await api
      .post("/api/admin/login")
      .send({ email: "inconnu@connecteo.fr", password: "MauvaisMdp123!" });

    const res = await api
      .get("/api/admin/audit-logs?pageSize=2&eventType=ADMIN_INVITED")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.logs.every((l: { event_type: string }) => l.event_type === "ADMIN_INVITED")).toBe(true);
  });

  it("filtre par succès/échec", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    await api
      .post("/api/admin/login")
      .send({ email: "inconnu@connecteo.fr", password: "MauvaisMdp123!" });

    const res = await api
      .get("/api/admin/audit-logs?success=false")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.logs.every((l: { success: boolean }) => l.success === false)).toBe(true);
  });

  it("ne journalise jamais de secret dans les détails (redaction)", async () => {
    const id = "sess-123";
    await logAuditEvent({
      eventType: AuditEventType.ERROR,
      action: "Test de redaction",
      success: false,
      details: { password: "Sup3rSecret", refresh_token: "abc.def", token: "xyz", safe: "ok" },
    });

    const log = await prisma.audit_log.findFirst({
      where: { event_type: AuditEventType.ERROR, action: "Test de redaction" },
    });

    expect(log).not.toBeNull();
    const details = log!.details as { password: string; refresh_token: string; safe: string };
    expect(details.password).toBe("[REDACTED]");
    expect(details.refresh_token).toBe("[REDACTED]");
    expect(details.token).toBe("[REDACTED]");
    expect(details.safe).toBe("ok");
    expect(id).toBe("sess-123");
  });

  it("attache bien un request_id de corrélation aux événements", async () => {
    const res = await api
      .post("/api/auth/login")
      .send({ email: "inconnu@connecteo.fr", password: "MauvaisMdp123!" });

    expect(res.status).toBe(401);

    const log = await prisma.audit_log.findFirst({
      where: { event_type: AuditEventType.LOGIN_FAILED },
    });

    expect(log).not.toBeNull();
    expect(log!.request_id).toBeTruthy();
    expect(res.headers["x-request-id"]).toBeTruthy();
  });
});

describe("Piste d'audit — rétention", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("purge uniquement les journaux plus vieux que la rétention", async () => {
    const oldId = await prisma.audit_log.create({
      data: {
        event_type: AuditEventType.LOGIN_FAILED,
        action: "Ancien",
        success: false,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    const recentId = await prisma.audit_log.create({
      data: {
        event_type: AuditEventType.LOGIN_SUCCESS,
        action: "Récent",
        success: true,
      },
      select: { id: true },
    });

    const { deleted } = await purgeAuditLogs(7);

    expect(deleted).toBe(1);
    expect(await prisma.audit_log.findUnique({ where: { id: oldId.id } })).toBeNull();
    expect(await prisma.audit_log.findUnique({ where: { id: recentId.id } })).not.toBeNull();
  });

  it("ne supprime rien si la rétention est invalide", async () => {
    await logAuditEvent({ eventType: AuditEventType.LOGOUT, action: "Test", success: true });

    const { deleted } = await purgeAuditLogs(0);

    expect(deleted).toBe(0);
    expect(await auditCount({})).toBeGreaterThan(0);
  });
});
