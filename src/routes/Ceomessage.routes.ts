import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.js";
import { validate } from "../middlewares/validate.js";
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
router.post("/", authenticate, requireAdmin, upload.single("image"), validate(ceoMessageCreateSchema), handleCreateCeoMessage);
router.put("/:id", authenticate, requireAdmin, upload.single("image"), validate(ceoMessageUpdateSchema), handleUpdateCeoMessage);
router.delete("/:id", authenticate, requireAdmin, handleDeleteCeoMessage);

export default router;