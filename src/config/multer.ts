import multer, { FileFilterCallback } from 'multer';
import type { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME = 'application/pdf';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (file.mimetype !== ALLOWED_MIME) {
    cb(new Error('Seuls les fichiers PDF sont acceptés'));
    return;
  }
  cb(null, true);
}

const uploadPdfMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export function uploadPdf(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.startsWith('multipart/form-data')) {
      next();
      return;
    }
    uploadPdfMiddleware.single(fieldName)(req, res, next);
  };
}
