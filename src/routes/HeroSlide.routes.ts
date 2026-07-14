import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
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
router.post("/", authenticate, requireAdmin, handleCreateHeroSlide);
router.put("/:id", authenticate, requireAdmin, handleUpdateHeroSlide);
router.delete("/:id", authenticate, requireAdmin, handleDeleteHeroSlide);

export default router;