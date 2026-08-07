import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.js";
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
router.post("/", authenticate, requireAdmin, upload.single("image"), validate(heroSlideCreateSchema), handleCreateHeroSlide);
router.put("/:id", authenticate, requireAdmin, upload.single("image"), validate(heroSlideUpdateSchema), handleUpdateHeroSlide);
router.delete("/:id", authenticate, requireAdmin, handleDeleteHeroSlide);

export default router;