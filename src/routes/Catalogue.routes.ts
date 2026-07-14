import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import {
  handleGetAllCatalogues,
  handleGetCatalogue,
  handleCreateCatalogue,
  handleUpdateCatalogue,
  handleDeleteCatalogue,
} from "../controllers/Catalogue.controller.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllCatalogues);
router.get("/:id", handleGetCatalogue);

// Admin only routes
router.post("/", authenticate, requireAdmin, handleCreateCatalogue);
router.put("/:id", authenticate, requireAdmin, handleUpdateCatalogue);
router.delete("/:id", authenticate, requireAdmin, handleDeleteCatalogue);

export default router;
