import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllReferences,
  handleGetReference,
  handleCreateReference,
  handleUpdateReference,
  handleDeleteReference,
} from "../controllers/Reference.controller.js";
import { referenceCreateSchema, referenceUpdateSchema } from "../validations/reference.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", handleGetAllReferences);
router.get("/:id", handleGetReference);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(referenceCreateSchema), handleCreateReference);
router.put("/:id", authenticate, requireAdmin, validate(referenceUpdateSchema), handleUpdateReference);
router.delete("/:id", authenticate, requireAdmin, handleDeleteReference);

export default router;
