import { Router } from "express";
import { authenticate, optionalAuthenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllArticles,
  handleGetArticle,
  handleCreateArticle,
  handleUpdateArticle,
  handleDeleteArticle,
} from "../controllers/Article.controller.js";
import { articleCreateSchema, articleUpdateSchema } from "../validations/article.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", optionalAuthenticate("onlyPublished"), handleGetAllArticles);
router.get("/:id", optionalAuthenticate(), handleGetArticle);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(articleCreateSchema), handleCreateArticle);
router.put("/:id", authenticate, requireAdmin, validate(articleUpdateSchema), handleUpdateArticle);
router.delete("/:id", authenticate, requireAdmin, handleDeleteArticle);

export default router;
