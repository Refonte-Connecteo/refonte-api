import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { uploadDirPath } from "../middlewares/upload.js";
import { isStorageConfigured } from "../services/storage.service.js";
import { getSafeFilePath } from "../utils/safeFile.js";
import { PRIVATE_DOCUMENT_EXTENSIONS, PRIVATE_REF_PREFIX, privateDirPath } from "../utils/privateFiles.js";

const IS_TEST = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

async function collectReferencedLocalFiles(): Promise<Set<string>> {
  const rows = await Promise.all([
    prisma.hero_slide.findMany({ select: { image_url: true, mobile_image_url: true } }),
    prisma.ceo_message.findMany({ select: { image_url: true } }),
    prisma.reference.findMany({ select: { image_url: true } }),
    prisma.catalogue.findMany({ select: { file_url: true } }),
    prisma.job_posting.findMany({ select: { fiche_url: true } }),
    prisma.application.findMany({ select: { cv_url: true } }),
    prisma.spontaneous_application.findMany({ select: { cv_url: true } }),
    prisma.contact_message.findMany({ select: { attachment_url: true } }),
    prisma.article.findMany({ select: { cover_url: true, file_url: true } }),
    prisma.event_image.findMany({ select: { image_url: true } }),
  ]);

  const referenced = new Set<string>();
  for (const row of rows.flat()) {
    for (const value of Object.values(row)) {
      if (typeof value === "string" && (value.startsWith("/uploads/") || value.startsWith(PRIVATE_REF_PREFIX))) {
        referenced.add(value);
      }
    }
  }
  return referenced;
}

/**
 * Supprime les fichiers locaux non référencés en base et âgés de plus de 24 h :
 * fichiers publics (uploads/) et fichiers privés des visiteurs (uploads/.private/).
 */
export async function sweepOrphanFiles(): Promise<{ deleted: number }> {
  const referenced = await collectReferencedLocalFiles();
  let deleted = 0;
  deleted += sweepDirectory(uploadDirPath, "/uploads/", referenced);
  deleted += sweepDirectory(privateDirPath, PRIVATE_REF_PREFIX, referenced);
  return { deleted };
}

function sweepDirectory(dir: string, refPrefix: string, referenced: Set<string>): number {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  const entries = fs.readdirSync(dir);
  const now = Date.now();
  let deleted = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (now - stat.mtimeMs < MIN_AGE_MS) continue;
    if (referenced.has(`${refPrefix}${entry}`)) continue;

    try {
      fs.unlinkSync(fullPath);
      deleted += 1;
    } catch (err) {
      logger.warn({ err, file: entry }, "Impossible de supprimer un fichier orphelin");
    }
  }

  return deleted;
}

/**
 * Migration unique et idempotente : les CV et pièces jointes déposés avant la mise en place des
 * fichiers privés (`/uploads/<nom>.pdf`, publics) sont déplacés dans uploads/.private sous un nom
 * aléatoire, et leurs références en base mises à jour. Un fichier également utilisé par un contenu
 * du site (catalogue, fiche de poste, article…) n'est jamais déplacé : la référence d'un visiteur
 * vers un fichier du site a pu être malveillante.
 */
export async function migrateLegacySubmittedFiles(): Promise<{ moved: number }> {
  if (isStorageConfigured()) {
    return { moved: 0 };
  }

  const contentRows = await Promise.all([
    prisma.hero_slide.findMany({ select: { image_url: true, mobile_image_url: true } }),
    prisma.ceo_message.findMany({ select: { image_url: true } }),
    prisma.reference.findMany({ select: { image_url: true } }),
    prisma.catalogue.findMany({ select: { file_url: true } }),
    prisma.job_posting.findMany({ select: { fiche_url: true } }),
    prisma.article.findMany({ select: { cover_url: true, file_url: true } }),
    prisma.event_image.findMany({ select: { image_url: true } }),
  ]);
  const usedByContent = new Set(
    contentRows.flat().flatMap((row) => Object.values(row)).filter((v): v is string => typeof v === "string"),
  );

  const submitted = await Promise.all([
    prisma.application.findMany({ select: { cv_url: true } }),
    prisma.spontaneous_application.findMany({ select: { cv_url: true } }),
    prisma.contact_message.findMany({ select: { attachment_url: true } }),
  ]);
  const legacyRefs = new Set(
    submitted
      .flat()
      .flatMap((row) => Object.values(row))
      .filter((v): v is string => typeof v === "string" && v.startsWith("/uploads/")),
  );

  let moved = 0;
  for (const oldRef of legacyRefs) {
    const fileName = oldRef.slice("/uploads/".length);
    const ext = path.extname(fileName).toLowerCase();
    if (!(PRIVATE_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext) || usedByContent.has(oldRef)) continue;

    const source = getSafeFilePath(uploadDirPath, fileName);
    if (!source || !fs.existsSync(source)) continue;

    const newName = `${randomUUID()}${ext}`;
    const newRef = `${PRIVATE_REF_PREFIX}${newName}`;
    fs.renameSync(source, path.join(privateDirPath, newName));
    await prisma.$transaction([
      prisma.application.updateMany({ where: { cv_url: oldRef }, data: { cv_url: newRef } }),
      prisma.spontaneous_application.updateMany({ where: { cv_url: oldRef }, data: { cv_url: newRef } }),
      prisma.contact_message.updateMany({ where: { attachment_url: oldRef }, data: { attachment_url: newRef } }),
    ]);
    moved += 1;
  }

  return { moved };
}

let timer: NodeJS.Timeout | null = null;

function nextRunDelay(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(4, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function run(): Promise<void> {
  try {
    const { moved } = await migrateLegacySubmittedFiles();
    if (moved > 0) logger.info({ moved }, "CV et pièces jointes déplacés vers le stockage privé");
  } catch (err) {
    logger.error(err, "Échec du déplacement des fichiers vers le stockage privé");
  }

  try {
    const { deleted } = await sweepOrphanFiles();
    logger.info({ deleted }, "Balayage des fichiers orphelins terminé");
  } catch (err) {
    logger.error(err, "Échec du balayage des fichiers orphelins");
  } finally {
    scheduleNext();
  }
}

function scheduleNext(): void {
  if (IS_TEST) return;
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => void run(), nextRunDelay());
}

/** Démarre le balayage quotidien (première exécution 2 min après le boot, puis à 04:00). */
export function startOrphanSweepJob(): void {
  if (IS_TEST) return;
  if (timer) return;
  timer = setTimeout(() => void run(), 120_000);
}

/** Arrête la planification (utile pour les tests). */
export function stopOrphanSweepJob(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
