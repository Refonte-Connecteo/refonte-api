import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllSpontaneousApplications,
  handleGetSpontaneousApplication,
  handleCreateSpontaneousApplication,
  handleUpdateSpontaneousApplication,
  handleDeleteSpontaneousApplication,
} from "../controllers/SpontaneousApplication.controller.js";
import { spontaneousApplicationCreateSchema, spontaneousApplicationUpdateSchema } from "../validations/spontaneousapplication.schema.js";

const router = Router();

// Public routes (affichage front - candidature spontanée publique)
router.get("/", handleGetAllSpontaneousApplications);
router.get("/:id", handleGetSpontaneousApplication);

// Public route - submission
router.post("/", validate(spontaneousApplicationCreateSchema), handleCreateSpontaneousApplication);

// Admin only routes
router.put("/:id", authenticate, requireAdmin, validate(spontaneousApplicationUpdateSchema), handleUpdateSpontaneousApplication);
router.delete("/:id", authenticate, requireAdmin, handleDeleteSpontaneousApplication);

export default router;
