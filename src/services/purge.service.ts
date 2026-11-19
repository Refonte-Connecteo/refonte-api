import fs from "node:fs";
import prisma from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.config.js";
import { deleteFile, isStorageConfigured } from "./storage.service.js";
import { getSafeFilePath } from "../utils/safeFile.js";
import { isPrivateFileRef, privateDirPath, privateFileNameFromRef, privateStorageKey } from "../utils/privateFiles.js";

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
 * Supprime physiquement un fichier envoyé par un visiteur (CV, pièce jointe).
 *
 * Seules les références privées `/private/<uuid>.<ext>` émises par /api/upload/cv|contact sont
 * supprimées. Toute autre valeur (ancienne URL `/uploads/...`, URL externe) a pu être choisie par
 * un visiteur malveillant pour viser un fichier du site (une image du hero, par exemple) : elle
 * est ignorée. Les vrais fichiers orphelins sont nettoyés par le balayage quotidien.
 * Lève une exception en cas d'échec : l'appelant journalise et continue.
 */
export async function deleteStoredFile(ref: string): Promise<boolean> {
  if (!isPrivateFileRef(ref)) {
    if (typeof ref === "string" && ref.trim() !== "") {
      logger.warn({ ref }, "Référence de fichier non privée ignorée : aucune suppression");
    }
    return false;
  }

  const name = privateFileNameFromRef(ref);
  if (isStorageConfigured()) {
    await deleteFile(privateStorageKey(name));
    return true;
  }

  const safePath = getSafeFilePath(privateDirPath, name);
  if (!safePath) {
    return false;
  }
  try {
    await fs.promises.unlink(safePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
  return true;
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
      if (await deleteStoredFile(row.cv_url)) {
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
 * (défaut : CONTACT_MESSAGE_RETENTION_MONTHS, 12 mois), pièces jointes comprises.
 */
export async function purgeExpiredContactMessages(
  retentionMonths?: number,
): Promise<{ deleted: number }> {
  const months = retentionMonths ?? env.CONTACT_MESSAGE_RETENTION_MONTHS;
  if (!Number.isFinite(months) || months <= 0) {
    return { deleted: 0 };
  }

  const cutoff = retentionCutoffMonths(months);
  const withAttachment = await prisma.contact_message.findMany({
    where: { submitted_at: { lt: cutoff }, attachment_url: { not: null } },
    select: { id: true, attachment_url: true },
  });
  for (const row of withAttachment) {
    try {
      await deleteStoredFile(row.attachment_url ?? "");
    } catch (err) {
      // Best-effort : un échec de fichier ne bloque pas la purge en base.
      logger.warn(
        { err, contactMessageId: row.id },
        "Échec de suppression de la pièce jointe pendant la purge",
      );
    }
  }

  const result = await prisma.contact_message.deleteMany({
    where: { submitted_at: { lt: cutoff } },
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
