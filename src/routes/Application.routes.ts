import { Router } from "express";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllApplications,
  handleGetApplication,
  handleGetApplicationsByJobId,
  handleCreateApplication,
  handleUpdateApplication,
  handleDeleteApplication,
} from "../controllers/Application.controller.js";
import { applicationCreateSchema, applicationUpdateSchema } from "../validations/application.schema.js";

const router = Router();

// Public routes (affichage front - candidature publique)
router.get("/", handleGetAllApplications);
router.get("/job/:jobId", handleGetApplicationsByJobId);
router.get("/:id", handleGetApplication);
router.post("/", validate(applicationCreateSchema), handleCreateApplication);

// Admin only routes
router.put("/:id", authenticate, requireAdmin, validate(applicationUpdateSchema), handleUpdateApplication);
router.delete("/:id", authenticate, requireAdmin, handleDeleteApplication);

export default router;
