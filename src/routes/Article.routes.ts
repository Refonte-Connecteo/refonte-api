import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllArticles,
  handleGetArticle,
  handleCreateArticle,
  handleUpdateArticle,
  handleDeleteArticle,
} from "../controllers/Article.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllArticles);
router.get("/:id", handleGetArticle);

// Admin only routes
router.post("/", authenticate, requireAdmin, handleCreateArticle);
router.put("/:id", authenticate, requireAdmin, handleUpdateArticle);
router.delete("/:id", authenticate, requireAdmin, handleDeleteArticle);

export default router;
