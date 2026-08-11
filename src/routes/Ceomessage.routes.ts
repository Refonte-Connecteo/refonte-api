import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { uploadImage, processUploadedFile, persistLocalFile } from "../middlewares/upload.js";
import { validate } from "../middlewares/validate.js";
import { IMAGE_FILE_KINDS } from "../utils/fileType.js";
import {
  handleGetAllCeoMessages,
  handleGetLatestCeoMessage,
  handleGetCeoMessage,
  handleCreateCeoMessage,
  handleUpdateCeoMessage,
  handleDeleteCeoMessage,
} from "../controllers/Ceomessage.controller.js";
import { ceoMessageCreateSchema, ceoMessageUpdateSchema } from "../validations/ceomessage.schema.js";

const router = Router();

// IMPORTANT: /latest doit être déclaré AVANT /:id
router.get("/latest", handleGetLatestCeoMessage);

// Public routes (affichage front)
router.get("/", handleGetAllCeoMessages);
router.get("/:id", handleGetCeoMessage);

// Admin only routes
router.post("/", authenticate, requireAdmin, uploadImage.single("image"), processUploadedFile(IMAGE_FILE_KINDS), validate(ceoMessageCreateSchema), persistLocalFile, handleCreateCeoMessage);
router.put("/:id", authenticate, requireAdmin, uploadImage.single("image"), processUploadedFile(IMAGE_FILE_KINDS), validate(ceoMessageUpdateSchema), persistLocalFile, handleUpdateCeoMessage);
router.delete("/:id", authenticate, requireAdmin, handleDeleteCeoMessage);

export default router;