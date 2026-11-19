import fs from "node:fs";
import path from "node:path";
import { uploadDirPath } from "../middlewares/upload.js";

/**
 * Fichiers privés : CV et pièces jointes envoyés par les visiteurs.
 *
 * - Stockés hors de la partie publique : `uploads/.private/` en local (express.static refuse
 *   les dossiers commençant par un point, et app.ts le bloque explicitement), `private/` en S3.
 * - Référencés en base par `/private/<uuid>.<ext>` : un nom aléatoire de 122 bits, impossible à deviner.
 * - Lisibles uniquement par un administrateur connecté (GET /api/upload/private/:name).
 */
export const PRIVATE_REF_PREFIX = "/private/";
export const privateDirPath = path.join(uploadDirPath, ".private");
if (!fs.existsSync(privateDirPath)) {
  fs.mkdirSync(privateDirPath, { recursive: true });
}

export const PRIVATE_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

const PRIVATE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$/;

/** Nom de fichier privé valide (UUID v4 + extension de document). */
export function isPrivateFileName(name: unknown): name is string {
  return typeof name === "string" && PRIVATE_NAME.test(name);
}

/**
 * Seule forme acceptée pour un fichier envoyé par un visiteur : une référence émise par
 * POST /api/upload/cv|contact. Interdit de pointer vers un fichier public du site
 * (une image du hero, par exemple) ou vers une adresse externe.
 */
export function isPrivateFileRef(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.startsWith(PRIVATE_REF_PREFIX) &&
    isPrivateFileName(value.slice(PRIVATE_REF_PREFIX.length))
  );
}

export function privateFileNameFromRef(ref: string): string {
  return ref.slice(PRIVATE_REF_PREFIX.length);
}

/** Clé de l'objet en stockage S3/R2. */
export function privateStorageKey(name: string): string {
  return `private/${name}`;
}
