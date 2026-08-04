import { Router } from "express";
import { body } from "express-validator";
import { authenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validateRequest, stringSchema } from "../middlewares/validation.middleware.js";
import {
  handleGetAllApplications,
  handleGetApplication,
  handleGetApplicationsByJobId,
  handleCreateApplication,
  handleUpdateApplication,
  handleDeleteApplication,
} from "../controllers/Application.controller.js";

const router = Router();

const createApplicationValidation = validateRequest([
  body("job_id").isInt({ min: 1 }).withMessage("job_id invalide"),
  stringSchema("first_name", { max: 100 }),
  stringSchema("last_name", { max: 100 }),
  body("email").trim().isEmail().withMessage("Email invalide"),
  stringSchema("phone", { optional: true, max: 30 }),
  stringSchema("cv_url", { optional: true, max: 500 }),
  stringSchema("cover_letter", { optional: true, max: 5000 }),
]);

// Public routes (affichage front - candidature publique)
router.get("/", handleGetAllApplications);
router.get("/job/:jobId", handleGetApplicationsByJobId);
router.get("/:id", handleGetApplication);
router.post("/", createApplicationValidation, handleCreateApplication);

// Admin only routes
router.put("/:id", authenticate, requireAdmin, handleUpdateApplication);
router.delete("/:id", authenticate, requireAdmin, handleDeleteApplication);

export default router;
