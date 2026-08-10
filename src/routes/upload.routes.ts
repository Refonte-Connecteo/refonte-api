import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { Router } from "express";
import { upload, uploadDirPath } from "../middlewares/upload.js";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { getSafeFilePath } from "../utils/safeFile.js";
import {
  isStorageConfigured,
  uploadFile,
} from "../services/storage.service.js";

const router = Router();

router.post("/", authenticate, requireAdmin, upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: "Aucun fichier fourni" });
    return;
  }

  if (isStorageConfigured()) {
    try {
      const key = `cvs/${randomUUID()}-${req.file.originalname}`;
      const body = fs.readFileSync(req.file.path);
      const url = await uploadFile({
        key,
        body,
        contentType: req.file.mimetype,
      });
      fs.unlinkSync(req.file.path);
      res.json({ url, filename: req.file.originalname });
    } catch (err) {
      next(err);
    }
    return;
  }

  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// Téléchargement sécurisé : bloque toute tentative de path traversal (403)
router.get("/:filename", (req, res) => {
  const safePath = getSafeFilePath(uploadDirPath, req.params.filename as string);

  if (!safePath) {
    res.status(403).json({ error: "Accès au fichier interdit" });
    return;
  }

  res.sendFile(safePath, (err) => {
    if (err) {
      res.status(404).json({ error: "Fichier introuvable" });
    }
  });
});

export default router;
