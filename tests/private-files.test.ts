import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/prisma.js";
import { api, createUser, signToken, resetDatabase } from "./helpers/auth.js";
import { uploadDirPath } from "../src/middlewares/upload.js";
import { privateDirPath, isPrivateFileRef } from "../src/utils/privateFiles.js";
import { deleteStoredFile } from "../src/services/purge.service.js";
import { migrateLegacySubmittedFiles, sweepOrphanFiles } from "../src/jobs/orphanFiles.job.js";

const created: string[] = [];

afterAll(async () => {
  for (const file of created) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* déjà supprimé */
    }
  }
  await prisma.$disconnect();
});

function tinyPdf(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
}

async function adminToken(): Promise<string> {
  const admin = await createUser({ userTypeId: 2 });
  return signToken(admin.id, 2, admin.email);
}

async function uploadCv(): Promise<{ url: string; name: string; file: string }> {
  const res = await api.post("/api/upload/cv").attach("file", tinyPdf(), { filename: "cv.pdf", contentType: "application/pdf" });
  expect(res.status).toBe(201);
  const url = res.body.url as string;
  const name = path.basename(url);
  const file = path.join(privateDirPath, name);
  created.push(file);
  return { url, name, file };
}

function writeFile(dir: string, name: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, tinyPdf());
  created.push(file);
  return file;
}

describe("Fichiers privés : références acceptées", () => {
  it("n'accepte qu'un /private/<uuid>.pdf|doc|docx", () => {
    expect(isPrivateFileRef(`/private/${randomUUID()}.pdf`)).toBe(true);
    expect(isPrivateFileRef(`/private/${randomUUID()}.docx`)).toBe(true);
    for (const bad of [
      "/uploads/hero.png",
      "/private/cv.pdf",
      `/private/${randomUUID()}.png`,
      `/private/../${randomUUID()}.pdf`,
      `https://evil.test/private/${randomUUID()}.pdf`,
      null,
      42,
    ]) {
      expect(isPrivateFileRef(bad)).toBe(false);
    }
  });
});

describe("Fichiers privés : lecture réservée aux administrateurs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("un CV déposé n'est pas servi publiquement", async () => {
    const { name, file } = await uploadCv();
    expect(fs.existsSync(file)).toBe(true);

    expect((await api.get(`/uploads/.private/${name}`)).status).toBe(404);
    expect((await api.get(`/uploads/${name}`)).status).toBe(404);
    expect((await api.get(`/api/upload/${name}`)).status).toBe(404);
    expect((await api.get(`/api/upload/private/${name}`)).status).toBe(401);
  });

  it("un administrateur le télécharge, sans mise en cache", async () => {
    const { name } = await uploadCv();
    const res = await api.get(`/api/upload/private/${name}`).set("Authorization", `Bearer ${await adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuse un nom qui n'est pas un fichier privé", async () => {
    const token = await adminToken();
    for (const name of ["cv.pdf", "..%2F..%2Fpackage.json", `${randomUUID()}.png`]) {
      expect((await api.get(`/api/upload/private/${name}`).set("Authorization", `Bearer ${token}`)).status).toBe(404);
    }
  });
});

describe("Fichiers privés : suppression", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("supprimer une candidature supprime son CV", async () => {
    const { url, file } = await uploadCv();
    const job = await prisma.job_posting.create({ data: { title: "Poste", contract_type: "CDI" } });
    const res = await api
      .post("/api/application")
      .send({ job_id: job.id, first_name: "Alex", last_name: "Martin", email: "alex@exemple.test", cv_url: url });
    expect(res.status).toBe(201);

    const del = await api
      .delete(`/api/application/${res.body.application.id}`)
      .set("Authorization", `Bearer ${await adminToken()}`);
    expect(del.status).toBe(200);
    expect(fs.existsSync(file)).toBe(false);
  });

  it("ne supprime jamais un fichier public visé par une ancienne référence", async () => {
    const heroImage = writeFile(uploadDirPath, `hero-test-${randomUUID()}.pdf`);
    expect(await deleteStoredFile(`/uploads/${path.basename(heroImage)}`)).toBe(false);
    expect(await deleteStoredFile("https://evil.test/cible.pdf")).toBe(false);
    expect(fs.existsSync(heroImage)).toBe(true);
  });
});

describe("Fichiers privés : migration des anciens CV", () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.catalogue.deleteMany();
  });

  it("déplace un ancien CV public, mais pas un fichier utilisé par le site", async () => {
    const legacyName = `ancien-cv-${randomUUID()}.pdf`;
    const legacyFile = writeFile(uploadDirPath, legacyName);
    const siteName = `catalogue-${randomUUID()}.pdf`;
    const siteFile = writeFile(uploadDirPath, siteName);

    const job = await prisma.job_posting.create({ data: { title: "Poste", contract_type: "CDI" } });
    const app = await prisma.application.create({
      data: { job_id: job.id, first_name: "A", last_name: "B", email: "a@b.test", cv_url: `/uploads/${legacyName}` },
    });
    await prisma.catalogue.create({ data: { title: "Catalogue", file_url: `/uploads/${siteName}` } });
    const malicious = await prisma.contact_message.create({
      data: { first_name: "X", last_name: "Y", email: "x@y.test", message: "spam", attachment_url: `/uploads/${siteName}` },
    });

    const { moved } = await migrateLegacySubmittedFiles();
    expect(moved).toBe(1);

    const migrated = await prisma.application.findUnique({ where: { id: app.id } });
    expect(isPrivateFileRef(migrated?.cv_url)).toBe(true);
    const newFile = path.join(privateDirPath, path.basename(migrated!.cv_url));
    created.push(newFile);
    expect(fs.existsSync(newFile)).toBe(true);
    expect(fs.existsSync(legacyFile)).toBe(false);

    // Le fichier du catalogue reste public et en place, même référencé par un message de contact.
    expect(fs.existsSync(siteFile)).toBe(true);
    expect((await prisma.contact_message.findUnique({ where: { id: malicious.id } }))?.attachment_url).toBe(`/uploads/${siteName}`);

    // Idempotente : rien à refaire au second passage.
    expect((await migrateLegacySubmittedFiles()).moved).toBe(0);
  });

  it("le balayage des orphelins ne touche pas aux fichiers privés référencés ou récents", async () => {
    const { file } = await uploadCv();
    await sweepOrphanFiles();
    expect(fs.existsSync(file)).toBe(true);
  });
});
