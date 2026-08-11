import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import express from "express";
import sharp from "sharp";
import prisma from "../src/lib/prisma.js";
import { api, createUser, signToken, resetDatabase } from "./helpers/auth.js";
import { uploadDirPath } from "../src/middlewares/upload.js";
import { createUploadCvLimiter } from "../src/middlewares/rateLimit.js";
import { AuditEventType } from "../src/services/audit.service.js";

const createdFiles: string[] = [];

afterAll(async () => {
  for (const file of createdFiles) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* déjà supprimé */
    }
  }
  await prisma.$disconnect();
});

async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
}

async function jpegWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 30, g: 60, b: 200 } },
  })
    .withExif({ IFD0: { Copyright: "Test copyright", Make: "Canon" } })
    .jpeg()
    .toBuffer();
}

function tinyPdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
}

function storedPathFromUrl(url: string): string {
  return path.join(uploadDirPath, path.basename(url));
}

describe("Uploads — CV public (sans authentification)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("accepte un PDF valide et journalise FILE_UPLOADED", async () => {
    const res = await api
      .post("/api/upload/cv")
      .attach("file", tinyPdf(), { filename: "cv.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[\w.-]+\.pdf$/);

    createdFiles.push(storedPathFromUrl(res.body.url as string));
    expect(fs.existsSync(storedPathFromUrl(res.body.url as string))).toBe(true);

    const log = await prisma.audit_log.findFirst({
      where: { event_type: AuditEventType.FILE_UPLOADED },
    });
    expect(log).not.toBeNull();
    expect(log!.actor_user_id).toBeNull();
    expect(log!.success).toBe(true);
  });

  it("rejette un contenu non autorisé (PNG sur endpoint CV)", async () => {
    const png = await tinyPng();
    const res = await api
      .post("/api/upload/cv")
      .attach("file", png, { filename: "cv.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(
      await prisma.audit_log.count({
        where: { event_type: AuditEventType.FILE_UPLOAD_REJECTED, success: false },
      }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("rejette un fichier sans magic bytes connus", async () => {
    const res = await api
      .post("/api/upload/cv")
      .attach("file", Buffer.from("contenu totalement quelconque"), {
        filename: "cv.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
  });

  it("rejette un fichier de plus de 5 Mo (413)", async () => {
    const res = await api
      .post("/api/upload/cv")
      .attach("file", Buffer.alloc(5.5 * 1024 * 1024), {
        filename: "cv.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(413);
  });
});

describe("Uploads — rate-limit dédié aux CV", () => {
  it("bloque au-delà de la limite (429)", async () => {
    const rateApp = express();
    rateApp.use(createUploadCvLimiter({ windowMs: 60_000, max: 2 }));
    rateApp.post("/", (_req, res) => res.json({ ok: true }));

    expect((await request(rateApp).post("/")).status).toBe(200);
    expect((await request(rateApp).post("/")).status).toBe(200);
    expect((await request(rateApp).post("/")).status).toBe(429);
  });
});

describe("Uploads — admin (authentifié)", () => {
  let token: string;

  beforeEach(async () => {
    await resetDatabase();
    const admin = await createUser({ userTypeId: 2 });
    token = signToken(admin.id, 2, admin.email);
  });

  it("exige l'authentification (401 sans token)", async () => {
    const res = await api
      .post("/api/upload")
      .attach("file", tinyPdf(), { filename: "doc.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(401);
  });

  it("accepte une image, la ré-encode et supprime les EXIF", async () => {
    const withExif = await jpegWithExif();
    const res = await api
      .post("/api/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", withExif, { filename: "photo.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    const storedPath = storedPathFromUrl(res.body.url as string);
    createdFiles.push(storedPath);

    const metadata = await sharp(storedPath).metadata();
    expect(metadata.exif).toBeUndefined();

    const download = await api.get(`/api/upload/${path.basename(storedPath)}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toBeUndefined();
  });

  it("rejette une extension incohérente avec le contenu (PNG renommé .jpg)", async () => {
    const png = await tinyPng();
    const res = await api
      .post("/api/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", png, { filename: "image.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(400);
  });

  it("rejette une image de plus de 10 Mo (413)", async () => {
    const res = await api
      .post("/api/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.alloc(10.5 * 1024 * 1024), {
        filename: "big.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(413);
  });

  it("force le téléchargement (Content-Disposition) pour les documents", async () => {
    const res = await api
      .post("/api/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", tinyPdf(), { filename: "doc.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);
    createdFiles.push(storedPathFromUrl(res.body.url as string));

    const download = await api.get(`/api/upload/${path.basename(res.body.url as string)}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toContain("attachment");
  });
});
