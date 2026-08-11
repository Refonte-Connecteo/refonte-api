import fs from "node:fs";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { uploadDirPath } from "../middlewares/upload.js";

const IS_TEST = process.env.VITEST === "true" || process.env.NODE_ENV === "test";
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

async function collectReferencedLocalFiles(): Promise<Set<string>> {
  const rows = await Promise.all([
    prisma.hero_slide.findMany({ select: { image_url: true } }),
    prisma.ceo_message.findMany({ select: { image_url: true } }),
    prisma.reference.findMany({ select: { image_url: true } }),
    prisma.catalogue.findMany({ select: { file_url: true } }),
    prisma.job_posting.findMany({ select: { fiche_url: true } }),
    prisma.application.findMany({ select: { cv_url: true } }),
    prisma.spontaneous_application.findMany({ select: { cv_url: true } }),
    prisma.article.findMany({ select: { cover_url: true, file_url: true } }),
    prisma.event_image.findMany({ select: { image_url: true } }),
  ]);

  const referenced = new Set<string>();
  for (const row of rows.flat()) {
    for (const value of Object.values(row)) {
      if (typeof value === "string" && value.startsWith("/uploads/")) {
        referenced.add(value);
      }
    }
  }
  return referenced;
}

/** Supprime les fichiers locaux (uploads/) non référencés en base et âgés de > 24h. */
export async function sweepOrphanFiles(): Promise<{ deleted: number }> {
  if (!fs.existsSync(uploadDirPath)) {
    return { deleted: 0 };
  }

  const referenced = await collectReferencedLocalFiles();
  const entries = fs.readdirSync(uploadDirPath);
  const now = Date.now();
  let deleted = 0;

  for (const entry of entries) {
    const fullPath = path.join(uploadDirPath, entry);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (now - stat.mtimeMs < MIN_AGE_MS) continue;
    if (referenced.has(`/uploads/${entry}`)) continue;

    try {
      fs.unlinkSync(fullPath);
      deleted += 1;
    } catch (err) {
      logger.warn({ err, file: entry }, "Impossible de supprimer un fichier orphelin");
    }
  }

  return { deleted };
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
