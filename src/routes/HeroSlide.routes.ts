import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.js";
import {
  handleGetAllHeroSlides,
  handleGetHeroSlide,
  handleCreateHeroSlide,
  handleUpdateHeroSlide,
  handleDeleteHeroSlide,
} from "../controllers/Heroslide.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllHeroSlides);
router.get("/:id", handleGetHeroSlide);

// Admin only routes
router.post("/", authenticate, requireAdmin, upload.single("image"), handleCreateHeroSlide);
router.put("/:id", authenticate, requireAdmin, upload.single("image"), handleUpdateHeroSlide);
router.delete("/:id", authenticate, requireAdmin, handleDeleteHeroSlide);

export default router;