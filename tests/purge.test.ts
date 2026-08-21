import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/prisma.js";
import { api, resetDatabase } from "./helpers/auth.js";
import {
  purgeExpiredApplications,
  purgeExpiredContactMessages,
  purgeExpiredSessions,
  runDataPurge,
} from "../src/services/purge.service.js";
import { uploadDirPath } from "../src/middlewares/upload.js";
import {
  applicationUpdateSchema,
  applicationCreateSchema,
} from "../src/validations/application.schema.js";
import { contactMessageCreateSchema } from "../src/validations/contactmessage.schema.js";

afterAll(async () => {
  await prisma.$disconnect();
});

function monthsAgo(months: number): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

function createLocalCvFile(): string {
  const filename = `purge-test-cv-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  fs.writeFileSync(path.join(uploadDirPath, filename), "%PDF-1.4 purge-test");
  return `/uploads/${filename}`;
}

describe("Purge des données expirées", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("purge les candidatures de plus de 24 mois avec suppression physique du CV local", async () => {
    const job = await prisma.job_posting.create({
      data: { title: "Développeur", contract_type: "CDI" },
    });

    const oldCvUrl = createLocalCvFile();
    const recentCvUrl = createLocalCvFile();

    await prisma.application.create({
      data: {
        job_id: job.id,
        first_name: "Old",
        last_name: "Candidate",
        email: "old@example.com",
        cv_url: oldCvUrl,
        submitted_at: monthsAgo(25),
      },
    });
    await prisma.application.create({
      data: {
        job_id: job.id,
        first_name: "Recent",
        last_name: "Candidate",
        email: "recent@example.com",
        cv_url: recentCvUrl,
        submitted_at: monthsAgo(1),
      },
    });
    await prisma.spontaneous_application.create({
      data: {
        first_name: "Spont",
        last_name: "Old",
        email: "spont@example.com",
        cv_url: createLocalCvFile(),
        submitted_at: monthsAgo(30),
      },
    });

    const result = await purgeExpiredApplications();

    expect(result.applications).toBe(1);
    expect(result.spontaneousApplications).toBe(1);
    expect(result.cvFilesDeleted).toBe(2);

    expect(await prisma.application.count()).toBe(1);
    expect(await prisma.spontaneous_application.count()).toBe(0);
    expect(fs.existsSync(path.join(uploadDirPath, path.basename(recentCvUrl)))).toBe(true);
    expect(fs.existsSync(path.join(uploadDirPath, path.basename(oldCvUrl)))).toBe(false);
  });

  it("purge les messages de contact de plus de 12 mois et conserve les récents", async () => {
    await prisma.contact_message.create({
      data: {
        first_name: "Old",
        last_name: "Message",
        email: "old@example.com",
        message: "Ancien message",
        submitted_at: monthsAgo(13),
      },
    });
    await prisma.contact_message.create({
      data: {
        first_name: "Recent",
        last_name: "Message",
        email: "recent@example.com",
        message: "Message récent",
        submitted_at: monthsAgo(2),
      },
    });

    const result = await purgeExpiredContactMessages();

    expect(result.deleted).toBe(1);
    expect(await prisma.contact_message.count()).toBe(1);
  });

  it("purge uniquement les tokens révoqués expirés", async () => {
    await prisma.revoked_token.createMany({
      data: [
        { token_hash: "hash-expire", expires_at: new Date(Date.now() - 60_000) },
        { token_hash: "hash-valide", expires_at: new Date(Date.now() + 60_000) },
      ],
    });

    const result = await purgeExpiredSessions();

    expect(result.deleted).toBe(1);
    expect(
      await prisma.revoked_token.findUnique({ where: { token_hash: "hash-valide" } }),
    ).not.toBeNull();
  });

  it("runDataPurge orchestre l'ensemble et retourne un résumé agrégé", async () => {
    const summary = await runDataPurge();

    expect(summary).toMatchObject({
      applications: 0,
      spontaneousApplications: 0,
      cvFilesDeleted: 0,
      contactMessages: 0,
      revokedTokens: 0,
      pageViews: 0,
    });
  });
});

describe("Minimisation des données collectées", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejette un message de contact contenant un champ non prévu", async () => {
    const res = await api.post("/api/contact-message").send({
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@example.com",
      message: "Bonjour",
      admin_notes: "champ pirate",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("non autoris");
    expect(await prisma.contact_message.count()).toBe(0);
  });

  it("accepte un message de contact strictement conforme", async () => {
    const res = await api.post("/api/contact-message").send({
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@example.com",
      message: "Bonjour",
    });

    expect(res.status).toBe(201);
    expect(await prisma.contact_message.count()).toBe(1);
  });

  it("rejette une candidature contenant un champ non prévu", async () => {
    const res = await api.post("/api/application").send({
      job_id: 1,
      first_name: "Marie",
      last_name: "Martin",
      email: "marie@example.com",
      cv_url: "/uploads/cv.pdf",
      salary_expectations: "confidentiel",
    });

    expect(res.status).toBe(400);
    expect(await prisma.application.count()).toBe(0);
  });

  it("les schémas Zod en mode strict rejettent les clés inconnues", () => {
    expect(
      applicationCreateSchema.safeParse({
        job_id: 1,
        first_name: "A",
        last_name: "B",
        email: "a@b.co",
        cv_url: "/uploads/cv.pdf",
        is_admin: true,
      }).success,
    ).toBe(false);

    expect(
      applicationUpdateSchema.safeParse({ email: "a@b.co", role: "superadmin" }).success,
    ).toBe(false);

    expect(
      contactMessageCreateSchema.safeParse({
        first_name: "A",
        last_name: "B",
        email: "a@b.co",
        message: "ok",
        internal_flag: 1,
      }).success,
    ).toBe(false);
  });
});
