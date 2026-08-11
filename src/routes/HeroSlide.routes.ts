import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { uploadImage, processUploadedFile, persistLocalFile } from "../middlewares/upload.js";
import { IMAGE_FILE_KINDS } from "../utils/fileType.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllHeroSlides,
  handleGetHeroSlide,
  handleCreateHeroSlide,
  handleUpdateHeroSlide,
  handleDeleteHeroSlide,
} from "../controllers/Heroslide.controller.js";
import { heroSlideCreateSchema, heroSlideUpdateSchema } from "../validations/heroslide.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllHeroSlides);
router.get("/:id", handleGetHeroSlide);

// Admin only routes
router.post("/", authenticate, requireAdmin, uploadImage.single("image"), processUploadedFile(IMAGE_FILE_KINDS), validate(heroSlideCreateSchema), persistLocalFile, handleCreateHeroSlide);
router.put("/:id", authenticate, requireAdmin, uploadImage.single("image"), processUploadedFile(IMAGE_FILE_KINDS), validate(heroSlideUpdateSchema), persistLocalFile, handleUpdateHeroSlide);
router.delete("/:id", authenticate, requireAdmin, handleDeleteHeroSlide);

export default router;