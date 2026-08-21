import fs from "node:fs";
import prisma from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.config.js";
import { deleteFile } from "./storage.service.js";
import { uploadDirPath } from "../middlewares/upload.js";
import { getSafeFilePath } from "../utils/safeFile.js";

const LOCAL_UPLOAD_PREFIX = "/uploads/";

/** Date limite de conservation : `months` mois en arrière. */
function retentionCutoffMonths(months: number): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

/** Date limite de conservation : `days` jours en arrière. */
function retentionCutoffDays(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Extrait la clé objet d'une URL de stockage S3/R2 du formulaire
 * `https://<endpoint>/<bucket>/<clé>` (cf. publicUrl()).
 */
function extractStorageKey(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    return segments.slice(1).join("/");
  } catch {
    return null;
  }
}

/**
 * Supprime physiquement un fichier CV référencé par son URL :
 * - chemin local `/uploads/<fichier>` → fichier disque (résolution sécurisée) ;
 * - URL http(s) S3/R2 → objet distant (no-op si le stockage n'est pas configuré).
 * Lève une exception en cas d'échec : l'appelant journalise et continue.
 */
async function deleteCvFile(cvUrl: string): Promise<boolean> {
  if (typeof cvUrl !== "string" || cvUrl.trim() === "") {
    return false;
  }

  if (cvUrl.startsWith(LOCAL_UPLOAD_PREFIX)) {
    const relativeName = cvUrl.slice(LOCAL_UPLOAD_PREFIX.length);
    const safePath = getSafeFilePath(uploadDirPath, relativeName);
    if (!safePath) {
      logger.warn({ cvUrl }, "Chemin CV suspect ignoré lors de la purge");
      return false;
    }
    await fs.promises.unlink(safePath);
    return true;
  }

  if (/^https?:\/\//i.test(cvUrl)) {
    const key = extractStorageKey(cvUrl);
    if (!key) {
      logger.warn({ cvUrl }, "URL de CV non exploitable ignorée lors de la purge");
      return false;
    }
    await deleteFile(key);
    return true;
  }

  return false;
}

export interface ExpiredApplicationsPurgeResult {
  applications: number;
  spontaneousApplications: number;
  cvFilesDeleted: number;
}

/**
 * Purge les candidatures (offres + spontanées) soumises depuis plus de
 * `retentionMonths` mois (défaut : APPLICATION_RETENTION_MONTHS, 24 mois).
 * Le fichier CV associé à chaque candidature est supprimé physiquement
 * (S3/R2 ou disque local) avant la suppression des lignes en base.
 */
export async function purgeExpiredApplications(
  retentionMonths?: number,
): Promise<ExpiredApplicationsPurgeResult> {
  const months = retentionMonths ?? env.APPLICATION_RETENTION_MONTHS;
  if (!Number.isFinite(months) || months <= 0) {
    return { applications: 0, spontaneousApplications: 0, cvFilesDeleted: 0 };
  }

  const cutoff = retentionCutoffMonths(months);

  const [applications, spontaneous] = await Promise.all([
    prisma.application.findMany({
      where: { submitted_at: { lt: cutoff } },
      select: { id: true, cv_url: true },
    }),
    prisma.spontaneous_application.findMany({
      where: { submitted_at: { lt: cutoff } },
      select: { id: true, cv_url: true },
    }),
  ]);

  let cvFilesDeleted = 0;
  for (const row of [...applications, ...spontaneous]) {
    try {
      if (await deleteCvFile(row.cv_url)) {
        cvFilesDeleted += 1;
      }
    } catch (err) {
      // Best-effort : un échec de fichier ne bloque pas la purge en base.
      logger.warn(
        { err, applicationId: row.id },
        "Échec de suppression du fichier CV pendant la purge",
      );
    }
  }

  const [deletedApplications, deletedSpontaneous] = await Promise.all([
    applications.length > 0
      ? prisma.application.deleteMany({
          where: { id: { in: applications.map((row) => row.id) } },
        })
      : Promise.resolve({ count: 0 }),
    spontaneous.length > 0
      ? prisma.spontaneous_application.deleteMany({
          where: { id: { in: spontaneous.map((row) => row.id) } },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    applications: deletedApplications.count,
    spontaneousApplications: deletedSpontaneous.count,
    cvFilesDeleted,
  };
}

/**
 * Purge les messages de contact soumis depuis plus de `retentionMonths` mois
 * (défaut : CONTACT_MESSAGE_RETENTION_MONTHS, 12 mois).
 */
export async function purgeExpiredContactMessages(
  retentionMonths?: number,
): Promise<{ deleted: number }> {
  const months = retentionMonths ?? env.CONTACT_MESSAGE_RETENTION_MONTHS;
  if (!Number.isFinite(months) || months <= 0) {
    return { deleted: 0 };
  }

  const result = await prisma.contact_message.deleteMany({
    where: { submitted_at: { lt: retentionCutoffMonths(months) } },
  });
  return { deleted: result.count };
}

/**
 * Purge les tokens révoqués dont la date d'expiration est dépassée :
 * ils ne peuvent plus être rejoués et ne présentent plus d'utilité.
 */
export async function purgeExpiredSessions(): Promise<{ deleted: number }> {
  const result = await prisma.revoked_token.deleteMany({
    where: { expires_at: { lt: new Date() } },
  });
  return { deleted: result.count };
}

/**
 * Purge les vues pages anonymisées au-delà de `retentionDays` jours
 * (défaut : PAGE_VIEW_RETENTION_DAYS, 395 jours / 13 mois).
 */
export async function purgeExpiredPageViews(
  retentionDays?: number,
): Promise<{ deleted: number }> {
  const days = retentionDays ?? env.PAGE_VIEW_RETENTION_DAYS;
  if (!Number.isFinite(days) || days <= 0) {
    return { deleted: 0 };
  }

  const result = await prisma.page_view.deleteMany({
    where: { created_at: { lt: retentionCutoffDays(days) } },
  });
  return { deleted: result.count };
}

export interface DataPurgeSummary extends ExpiredApplicationsPurgeResult {
  contactMessages: number;
  revokedTokens: number;
  pageViews: number;
}

/**
 * Orchestration complète de la politique de rétention :
 * candidatures (+ CV), messages de contact, sessions expirées, analytics.
 * Retourne un résumé agrégé destiné aux logs / à la CLI.
 */
export async function runDataPurge(): Promise<DataPurgeSummary> {
  const [applications, contactMessages, sessions, pageViews] = await Promise.all([
    purgeExpiredApplications(),
    purgeExpiredContactMessages(),
    purgeExpiredSessions(),
    purgeExpiredPageViews(),
  ]);

  const summary: DataPurgeSummary = {
    ...applications,
    contactMessages: contactMessages.deleted,
    revokedTokens: sessions.deleted,
    pageViews: pageViews.deleted,
  };

  logger.info(summary, "Purge des données expirées terminée");
  return summary;
}
