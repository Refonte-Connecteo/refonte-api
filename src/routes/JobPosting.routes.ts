import { Router } from "express";
import { authenticate, optionalAuthenticate, requireAdmin } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  handleGetAllJobPostings,
  handleGetJobPosting,
  handleCreateJobPosting,
  handleUpdateJobPosting,
  handleDeleteJobPosting,
} from "../controllers/JobPosting.controller.js";
import { jobPostingCreateSchema, jobPostingUpdateSchema } from "../validations/jobposting.schema.js";

const router = Router();

// Public routes (affichage front)
router.get("/", optionalAuthenticate("onlyActive"), handleGetAllJobPostings);
router.get("/:id", optionalAuthenticate(), handleGetJobPosting);

// Admin only routes
router.post("/", authenticate, requireAdmin, validate(jobPostingCreateSchema), handleCreateJobPosting);
router.put("/:id", authenticate, requireAdmin, validate(jobPostingUpdateSchema), handleUpdateJobPosting);
router.delete("/:id", authenticate, requireAdmin, handleDeleteJobPosting);

export default router;
