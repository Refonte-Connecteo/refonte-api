import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllCatalogues,
  handleGetCatalogue,
  handleCreateCatalogue,
  handleUpdateCatalogue,
  handleDeleteCatalogue,
} from "../controllers/Catalogue.controller.js";
import { catalogueCreateSchema, catalogueUpdateSchema } from "../validations/catalogue.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllCatalogues);
router.get("/:id", handleGetCatalogue);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(catalogueCreateSchema), handleCreateCatalogue);
router.put("/:id", authenticate, requireAdmin, validate(catalogueUpdateSchema), handleUpdateCatalogue);
router.delete("/:id", authenticate, requireAdmin, handleDeleteCatalogue);

export default router;
