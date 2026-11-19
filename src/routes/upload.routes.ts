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
import { getFileStream, isStorageConfigured, uploadFile } from "../services/storage.service.js";
import {
  PRIVATE_DOCUMENT_EXTENSIONS,
  PRIVATE_REF_PREFIX,
  isPrivateFileName,
  privateDirPath,
  privateStorageKey,
} from "../utils/privateFiles.js";
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

/**
 * Document envoyé par un visiteur (CV, pièce jointe) : stocké hors de la partie publique,
 * sous un nom aléatoire (UUID), et référencé par `/private/<nom>`. Seul un admin peut le lire.
 */
async function persistPrivateDocument(file: StoredMulterFile): Promise<{ url: string; filename: string }> {
  const ext = path.extname(file.originalname).toLowerCase();
  const safeExt = (PRIVATE_DOCUMENT_EXTENSIONS as readonly string[]).includes(ext) ? ext : ".pdf";
  const name = `${randomUUID()}${safeExt}`;

  if (isStorageConfigured()) {
    await uploadFile({ key: privateStorageKey(name), body: file.buffer, contentType: file.mimetype });
  } else {
    fs.writeFileSync(path.join(privateDirPath, name), file.buffer);
  }
  return { url: `${PRIVATE_REF_PREFIX}${name}`, filename: name };
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
      await logAuditEvent({
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

/**
 * Upload public d'un document (5 Mo, pdf/doc/docx), sans authentification :
 * limité par IP, type vérifié sur le contenu réel du fichier, nom généré côté serveur.
 */
function publicDocumentUpload(action: string) {
  return [
    uploadCvLimiter,
    uploadCv.single("file"),
    processUploadedFile(CV_FILE_KINDS),
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.file) {
        res.status(400).json({ error: "Aucun fichier fourni" });
        return;
      }

      try {
        const { url, filename } = await persistPrivateDocument(req.file);
        // L'adresse du fichier n'est pas recopiée dans le journal : seul son nom aléatoire l'est.
        await logAuditEvent({
          eventType: AuditEventType.FILE_UPLOADED,
          action,
          success: true,
          resourceType: "file",
          resourceId: filename,
          details: { size: req.file.size },
          meta: buildAuditMeta(req),
        });
        res.status(201).json({ url, filename });
      } catch (err) {
        next(err);
      }
    },
  ];
}

// CV du formulaire carrière.
router.post("/cv", ...publicDocumentUpload("Upload de CV"));

// Pièce jointe facultative du formulaire de contact (demande de collaboration).
router.post("/contact", ...publicDocumentUpload("Upload de pièce jointe de contact"));

// Lecture d'un CV ou d'une pièce jointe : administrateurs connectés uniquement.
// Toujours en téléchargement (jamais affiché dans le navigateur), jamais mis en cache.
router.get("/private/:name", authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  const name = req.params.name as string;
  if (!isPrivateFileName(name)) {
    res.status(404).json({ error: "Fichier introuvable" });
    return;
  }

  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  try {
    if (isStorageConfigured()) {
      const object = await getFileStream(privateStorageKey(name));
      if (!object) {
        res.status(404).json({ error: "Fichier introuvable" });
        return;
      }
      res.type(object.contentType ?? path.extname(name));
      object.body.pipe(res);
      return;
    }

    const safePath = getSafeFilePath(privateDirPath, name);
    if (!safePath) {
      res.status(404).json({ error: "Fichier introuvable" });
      return;
    }
    res.type(path.extname(name));
    res.sendFile(safePath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Fichier introuvable" });
    });
  } catch (err) {
    next(err);
  }
});

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
