import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  uploadCv,
  uploadGeneric,
  processUploadedFile,
  uploadDirPath,
  type StoredMulterFile,
} from "../middlewares/upload.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { getSafeFilePath } from "../utils/safeFile.js";
import { isStorageConfigured, uploadFile } from "../services/storage.service.js";
import { uploadCvLimiter } from "../middlewares/rateLimit.js";
import {
  logAuditEvent,
  buildAuditMeta,
  AuditEventType,
} from "../services/audit.service.js";
import { ALL_FILE_KINDS, CV_FILE_KINDS } from "../utils/fileType.js";

const router = Router();

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

/**
 * Persiste le fichier validé (S3/R2 si configuré, sinon disque local).
 * Clé/nom générés côté serveur, ContentType calculé depuis le vrai type.
 */
async function persistUploadedFile(
  file: StoredMulterFile,
  prefix: string,
): Promise<{ url: string; filename: string }> {
  const safeOriginal = path
    .basename(file.originalname)
    .replace(/[^\w.\-() ]/g, "_")
    .slice(0, 120);

  if (isStorageConfigured()) {
    const key = `${prefix}/${randomUUID()}-${safeOriginal}`;
    const url = await uploadFile({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });
    return { url, filename: safeOriginal };
  }

  const ext = path.extname(safeOriginal).toLowerCase() || "";
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(uploadDirPath, name), file.buffer);
  return { url: `/uploads/${name}`, filename: name };
}

// Upload générique (admin) : images (10 Mo) et documents. Utilisé par ImageUpload.
router.post(
  "/",
  authenticate,
  requireAdmin,
  uploadGeneric.single("file"),
  processUploadedFile(ALL_FILE_KINDS),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni" });
      return;
    }

    try {
      const actor = req.user;
      const { url, filename } = await persistUploadedFile(req.file, "uploads");
      void logAuditEvent({
        eventType: AuditEventType.FILE_UPLOADED,
        action: "Upload de fichier",
        success: true,
        actorUserId: actor?.userId ?? null,
        actorEmail: actor?.email ?? null,
        resourceType: "file",
        resourceId: filename,
        details: { size: req.file.size, url },
        meta: buildAuditMeta(req),
      });
      res.status(201).json({ url, filename });
    } catch (err) {
      next(err);
    }
  },
);

// Upload de CV public (5 Mo, pdf/doc/docx) pour le formulaire carriere.
router.post(
  "/cv",
  uploadCvLimiter,
  uploadCv.single("file"),
  processUploadedFile(CV_FILE_KINDS),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni" });
      return;
    }

    try {
      const { url, filename } = await persistUploadedFile(req.file, "cvs");
      void logAuditEvent({
        eventType: AuditEventType.FILE_UPLOADED,
        action: "Upload de CV",
        success: true,
        resourceType: "file",
        resourceId: filename,
        details: { size: req.file.size, url },
        meta: buildAuditMeta(req),
      });
      res.status(201).json({ url, filename });
    } catch (err) {
      next(err);
    }
  },
);

// Téléchargement sécurisé : bloque toute tentative de path traversal (403),
// force le téléchargement pour les documents (pdf/doc/docx) afin de limiter
// l'exécution de contenu embarqué.
router.get("/:filename", (req, res) => {
  const safePath = getSafeFilePath(uploadDirPath, req.params.filename as string);

  if (!safePath) {
    res.status(403).json({ error: "Accès au fichier interdit" });
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(safePath)}"`,
    );
  }
  res.type(ext);

  res.sendFile(safePath, (err) => {
    if (err) {
      res.status(404).json({ error: "Fichier introuvable" });
    }
  });
});

export default router;
