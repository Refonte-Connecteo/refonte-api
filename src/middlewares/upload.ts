import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import type { NextFunction, Request, Response } from "express";
import {
  detectFileKind,
  extensionsForKind,
  canonicalExtensionForKind,
  mimeForKind,
  IMAGE_FILE_KINDS,
  CV_FILE_KINDS,
  ALL_FILE_KINDS,
  type DetectedFileKind,
} from "../utils/fileType.js";
import { AppError } from "../errors/index.js";
import {
  logAuditEvent,
  buildAuditMeta,
  AuditEventType,
} from "../services/audit.service.js";

export const uploadDirPath = path.resolve("uploads");
if (!fs.existsSync(uploadDirPath)) {
  fs.mkdirSync(uploadDirPath, { recursive: true });
}

export const MAX_CV_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 Mo (CV)
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo (images)
const MAX_IMAGE_DIMENSION = 2000;

interface UploadOptions {
  maxSize: number;
  kinds: DetectedFileKind[];
}

/**
 * Usine de middleware multer (memoryStorage) : limite de taille + whitelist
 * d'extensions. La validation du CONTENU (magic bytes) et le traitement
 * serveur se font ensuite dans processUploadedFile.
 */
function createUploadMiddleware(options: UploadOptions) {
  const allowedExtensions = options.kinds.flatMap(extensionsForKind);
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxSize },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(1);
      if (!allowedExtensions.includes(ext)) {
        void logAuditEvent({
          eventType: AuditEventType.FILE_UPLOAD_REJECTED,
          action: "Upload rejeté : format non supporté",
          success: false,
          statusCode: 400,
          errorCode: "UNSUPPORTED_EXTENSION",
          details: { filename: file.originalname, extension: ext },
          meta: buildAuditMeta(req),
        });
        cb(
          new AppError(
            `Format de fichier non supporté (${ext || "aucune extension"}). Formats acceptés : ${allowedExtensions.join(", ")}`,
            400,
          ),
        );
        return;
      }
      cb(null, true);
    },
  });
}

/** Upload d'image (10 Mo) : jpeg, png, webp, gif. */
export const uploadImage = createUploadMiddleware({
  maxSize: MAX_IMAGE_UPLOAD_BYTES,
  kinds: IMAGE_FILE_KINDS,
});

/** Upload de CV (5 Mo) : pdf, doc, docx. */
export const uploadCv = createUploadMiddleware({
  maxSize: MAX_CV_UPLOAD_BYTES,
  kinds: CV_FILE_KINDS,
});

/** Upload générique admin (10 Mo) : images + documents. */
export const uploadGeneric = createUploadMiddleware({
  maxSize: MAX_IMAGE_UPLOAD_BYTES,
  kinds: ALL_FILE_KINDS,
});

export type StoredMulterFile = Express.Multer.File & {
  kind?: DetectedFileKind;
};

/**
 * Valide le contenu du fichier (magic bytes) et vérifie la cohérence avec
 * l'extension déclarée. Ré-encode les images avec sharp (décodage obligatoire,
 * suppression EXIF, auto-orientation, limite de dimensions). En cas de rejet,
 * journalise un événement FILE_UPLOAD_REJECTED dans la piste d'audit.
 */
export function processUploadedFile(kinds: DetectedFileKind[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file as StoredMulterFile | undefined;
      if (!file) {
        next();
        return;
      }

      const meta = buildAuditMeta(req);
      const details = { filename: file.originalname, size: file.size };

      const reject = async (reason: string, errorCode: string): Promise<void> => {
        await logAuditEvent({
          eventType: AuditEventType.FILE_UPLOAD_REJECTED,
          action: "Upload rejeté",
          success: false,
          statusCode: 400,
          errorCode,
          details: { ...details, reason },
          meta,
        });
      };

      const detected = detectFileKind(file.buffer);
      if (!detected || !kinds.includes(detected)) {
        await reject("contenu non autorisé", "INVALID_FILE_CONTENT");
        next(new AppError("Le contenu du fichier n'est pas un format autorisé", 400));
        return;
      }

      const declaredExt = path.extname(file.originalname).toLowerCase().slice(1);
      if (!extensionsForKind(detected).includes(declaredExt)) {
        await reject("type de fichier incohérent avec l'extension", "FILE_TYPE_MISMATCH");
        next(new AppError("Le type de fichier ne correspond pas à son extension", 400));
        return;
      }

      let buffer = file.buffer;
      if (IMAGE_FILE_KINDS.includes(detected)) {
        try {
          buffer = await sharp(file.buffer)
            .rotate()
            .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .toBuffer();
        } catch {
          await reject("image corrompue ou non décodable", "IMAGE_DECODE_FAILED");
          next(new AppError("L'image est corrompue ou non décodable", 400));
          return;
        }
      }

      file.buffer = buffer;
      file.mimetype = mimeForKind(detected);
      file.kind = detected;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Persiste le buffer validé sur le disque local (uploads/) avec un nom
 * généré par le serveur et une extension canonique. Définit req.file.filename.
 * Ne fait rien si aucun fichier n'a été envoyé.
 */
export function persistLocalFile(req: Request, _res: Response, next: NextFunction): void {
  const file = req.file as StoredMulterFile | undefined;
  if (!file) {
    next();
    return;
  }

  try {
    const ext = file.kind
      ? canonicalExtensionForKind(file.kind)
      : path.extname(file.originalname).toLowerCase().slice(1);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    fs.writeFileSync(path.join(uploadDirPath, name), file.buffer);
    file.filename = name;
    file.path = path.join(uploadDirPath, name);
    next();
  } catch (err) {
    next(err);
  }
}
